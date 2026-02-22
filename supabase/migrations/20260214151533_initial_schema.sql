


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."is_within_radius"("p_latitude" numeric, "p_longitude" numeric, "p_radius_meters" integer DEFAULT 500) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*)
    INTO v_count
    FROM control_points cp
    WHERE cp.active = true
      AND ST_DWithin(
          cp.location,
          ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
          p_radius_meters
      );

    RETURN v_count > 0;
END;
$$;


ALTER FUNCTION "public"."is_within_radius"("p_latitude" numeric, "p_longitude" numeric, "p_radius_meters" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_within_radius"("p_latitude" numeric, "p_longitude" numeric, "p_radius_meters" integer) IS 'Simple boolean check if location is within radius.
Returns true if at least one control point is within specified radius.';



CREATE OR REPLACE FUNCTION "public"."update_location"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_location"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_proximity"("p_latitude" numeric, "p_longitude" numeric, "p_acceptable_radius_meters" integer DEFAULT 500, "p_max_uber_distance_km" integer DEFAULT 20, "p_max_coverage_km" integer DEFAULT 50) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_user_location GEOGRAPHY;
    v_closest_point JSON;
    v_points_within_radius JSON;
    v_distance_km DECIMAL;
    v_alert VARCHAR;
    v_status VARCHAR;
BEGIN
    -- Create user location point
    v_user_location := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

    -- Find closest control point
    SELECT json_build_object(
        'id', cp.id,
        'title', cp.title,
        'full_address', cp.full_address,
        'latitude', cp.latitude,
        'longitude', cp.longitude,
        'distance_meters', ROUND(ST_Distance(cp.location, v_user_location)::numeric, 2),
        'distance_km', ROUND((ST_Distance(cp.location, v_user_location) / 1000)::numeric, 2)
    ),
    ROUND((ST_Distance(cp.location, v_user_location) / 1000)::numeric, 2)
    INTO v_closest_point, v_distance_km
    FROM control_points cp
    WHERE cp.active = true
    ORDER BY cp.location <-> v_user_location
    LIMIT 1;

    -- Find all points within acceptable radius
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', cp.id,
            'title', cp.title,
            'latitude', cp.latitude,
            'longitude', cp.longitude,
            'distance_meters', ROUND(ST_Distance(cp.location, v_user_location)::numeric, 2)
        )
        ORDER BY ST_Distance(cp.location, v_user_location)
    ), '[]'::json)
    INTO v_points_within_radius
    FROM control_points cp
    WHERE cp.active = true
      AND ST_DWithin(cp.location, v_user_location, p_acceptable_radius_meters);

    -- Determine status and alert
    IF (SELECT count(*) FROM json_array_elements(v_points_within_radius)) > 0 THEN
        v_status := 'WITHIN_RADIUS';
        v_alert := NULL;
    ELSIF v_distance_km <= p_max_uber_distance_km THEN
        v_status := 'UBER_REQUIRED';
        v_alert := format('User is %s km from nearest point. Uber pickup required.', v_distance_km);
    ELSIF v_distance_km <= p_max_coverage_km THEN
        v_status := 'MANUAL_REVIEW';
        v_alert := format('User is %s km from nearest point. Manual review required.', v_distance_km);
    ELSE
        v_status := 'OUT_OF_COVERAGE';
        v_alert := format('User is %s km from nearest point. Outside coverage area.', v_distance_km);
    END IF;

    -- Build response
    RETURN json_build_object(
        'status', v_status,
        'alert', v_alert,
        'user_location', json_build_object(
            'latitude', p_latitude,
            'longitude', p_longitude
        ),
        'validation_params', json_build_object(
            'acceptable_radius_meters', p_acceptable_radius_meters,
            'max_uber_distance_km', p_max_uber_distance_km,
            'max_coverage_km', p_max_coverage_km
        ),
        'closest_point', v_closest_point,
        'points_within_radius', v_points_within_radius
    );
END;
$$;


ALTER FUNCTION "public"."validate_proximity"("p_latitude" numeric, "p_longitude" numeric, "p_acceptable_radius_meters" integer, "p_max_uber_distance_km" integer, "p_max_coverage_km" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_proximity"("p_latitude" numeric, "p_longitude" numeric, "p_acceptable_radius_meters" integer, "p_max_uber_distance_km" integer, "p_max_coverage_km" integer) IS 'Main validation function for E2E flow
Returns status codes:
- WITHIN_RADIUS: User is within acceptable walking distance
- UBER_REQUIRED: User needs Uber to reach pickup point
- MANUAL_REVIEW: Distance requires manual review
- OUT_OF_COVERAGE: User is outside service coverage

Use in n8n agent:
1. User provides pickup address → Geocode to lat/lon
2. Call validate_proximity(lat, lon)
3. If status = WITHIN_RADIUS → Proceed
4. If status = UBER_REQUIRED → Schedule Uber
5. If status = MANUAL_REVIEW or OUT_OF_COVERAGE → Alert agent for manual processing

Repeat for destination address.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" integer NOT NULL,
    "agent_id" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "business_name" character varying(255) NOT NULL,
    "business_type" character varying(100),
    "business_category" character varying(100),
    "price_range" "jsonb",
    "products" "jsonb",
    "delivery" "jsonb",
    "payment_methods" "jsonb",
    "faqs" "jsonb",
    "objection_handling" "jsonb",
    "agent_personality" "jsonb",
    "required_info" "jsonb",
    "warranty" "text",
    "payment_gateway" character varying(50),
    "payment_links" "jsonb",
    "custom_instructions" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "client_id" "uuid"
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."agents_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."agents_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."agents_id_seq" OWNED BY "public"."agents"."id";



CREATE TABLE IF NOT EXISTS "public"."chat_history" (
    "id" integer NOT NULL,
    "agent_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "role" character varying(20) NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_history_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['user'::character varying, 'assistant'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."chat_history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."chat_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."chat_history_id_seq" OWNED BY "public"."chat_history"."id";



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(50),
    "company_name" character varying(255),
    "auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."token_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "total_tokens" bigint DEFAULT 0,
    "used_tokens" bigint DEFAULT 0,
    "available_tokens" bigint GENERATED ALWAYS AS (("total_tokens" - "used_tokens")) STORED,
    "is_active" boolean DEFAULT true,
    "low_balance_notified" boolean DEFAULT false,
    "last_recharge_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."token_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."token_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "agent_id" character varying,
    "package_id" "uuid",
    "type" character varying(20) NOT NULL,
    "tokens" integer NOT NULL,
    "amount_cop" integer,
    "payment_id" character varying(100),
    "payment_status" character varying(20),
    "mercadopago_preference_id" character varying(100),
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "token_transactions_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['purchase'::character varying, 'consumption'::character varying, 'bonus'::character varying, 'refund'::character varying])::"text"[])))
);


ALTER TABLE "public"."token_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."client_token_summary" AS
 SELECT "tb"."client_id",
    "c"."name" AS "client_name",
    "c"."email",
    "tb"."total_tokens",
    "tb"."used_tokens",
    "tb"."available_tokens",
    "tb"."is_active",
    ( SELECT "count"(*) AS "count"
           FROM "public"."agents" "a"
          WHERE ("a"."client_id" = "tb"."client_id")) AS "total_agents",
    ( SELECT "json_agg"("json_build_object"('agent_id', "a"."agent_id", 'business_name', "a"."business_name", 'tokens_used', COALESCE(( SELECT "sum"("abs"("tt"."tokens")) AS "sum"
                   FROM "public"."token_transactions" "tt"
                  WHERE ((("tt"."agent_id")::"text" = ("a"."agent_id")::"text") AND (("tt"."type")::"text" = 'consumption'::"text"))), (0)::bigint))) AS "json_agg"
           FROM "public"."agents" "a"
          WHERE ("a"."client_id" = "tb"."client_id")) AS "agents_breakdown"
   FROM ("public"."token_balances" "tb"
     JOIN "public"."clients" "c" ON (("c"."id" = "tb"."client_id")));


ALTER VIEW "public"."client_token_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."control_points" (
    "id" bigint NOT NULL,
    "title" character varying(300) NOT NULL,
    "full_address" "text",
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "location" "public"."geography"(Point,4326),
    "google_maps_url" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."control_points" OWNER TO "postgres";


COMMENT ON TABLE "public"."control_points" IS 'All pickup and destination control points';



CREATE SEQUENCE IF NOT EXISTS "public"."control_points_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."control_points_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."control_points_id_seq" OWNED BY "public"."control_points"."id";



CREATE TABLE IF NOT EXISTS "public"."lead_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_name" "text" NOT NULL,
    "company_url" "text" NOT NULL,
    "country" "text" NOT NULL,
    "target_persona" "text",
    "extra_context" "text",
    "extracted_text" "text",
    "extracted_emails" "text"[],
    "extracted_phones" "text"[],
    "detected_signals" "text"[],
    "industry" "text",
    "company_description" "text",
    "recommended_service_id" "text",
    "recommended_service_name" "text",
    "confidence_score" integer,
    "reasoning" "text",
    "email_subject" "text",
    "email_body" "text",
    "contacts" "jsonb",
    "discovery_question" "text",
    "full_analysis" "jsonb"
);


ALTER TABLE "public"."lead_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" integer NOT NULL,
    "agent_id" character varying(255) NOT NULL,
    "name" character varying(255),
    "phone" character varying(50),
    "email" character varying(255),
    "address" "text",
    "notes" "text",
    "status" character varying(50) DEFAULT 'new'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "source" "text",
    CONSTRAINT "leads_source_check" CHECK (("length"("source") <= 50)),
    CONSTRAINT "leads_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['new'::character varying, 'contacted'::character varying, 'converted'::character varying, 'lost'::character varying])::"text"[])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."leads_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."leads_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."leads_id_seq" OWNED BY "public"."leads"."id";



CREATE TABLE IF NOT EXISTS "public"."token_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "display_name" character varying(100) NOT NULL,
    "tokens" integer NOT NULL,
    "price_cop" integer NOT NULL,
    "price_usd" numeric(10,2),
    "description" "text",
    "conversations_approx" integer,
    "active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."token_packages" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agents" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."agents_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."chat_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."chat_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."control_points" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."control_points_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."leads" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."leads_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_agent_id_key" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_points"
    ADD CONSTRAINT "control_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_analyses"
    ADD CONSTRAINT "lead_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_balances"
    ADD CONSTRAINT "token_balances_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."token_balances"
    ADD CONSTRAINT "token_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_packages"
    ADD CONSTRAINT "token_packages_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."token_packages"
    ADD CONSTRAINT "token_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_transactions"
    ADD CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_agents_agent_id" ON "public"."agents" USING "btree" ("agent_id");



CREATE INDEX "idx_agents_client_id" ON "public"."agents" USING "btree" ("client_id");



CREATE INDEX "idx_chat_history_agent_user" ON "public"."chat_history" USING "btree" ("agent_id", "user_id");



CREATE INDEX "idx_chat_history_created_at" ON "public"."chat_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "idx_company_name" ON "public"."lead_analyses" USING "btree" ("company_name");



CREATE INDEX "idx_confidence_score" ON "public"."lead_analyses" USING "btree" ("confidence_score" DESC);



CREATE INDEX "idx_control_points_geo" ON "public"."control_points" USING "gist" ("location");



CREATE INDEX "idx_country" ON "public"."lead_analyses" USING "btree" ("country");



CREATE INDEX "idx_created_at" ON "public"."lead_analyses" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_agent_id" ON "public"."leads" USING "btree" ("agent_id");



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_token_transactions_agent" ON "public"."token_transactions" USING "btree" ("agent_id");



CREATE INDEX "idx_token_transactions_client" ON "public"."token_transactions" USING "btree" ("client_id");



CREATE INDEX "idx_token_transactions_created" ON "public"."token_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_token_transactions_payment" ON "public"."token_transactions" USING "btree" ("payment_id");



CREATE INDEX "idx_token_transactions_type" ON "public"."token_transactions" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "trigger_update_location" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."control_points" FOR EACH ROW EXECUTE FUNCTION "public"."update_location"();



CREATE OR REPLACE TRIGGER "update_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_balances"
    ADD CONSTRAINT "token_balances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_transactions"
    ADD CONSTRAINT "token_transactions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id");



ALTER TABLE ONLY "public"."token_transactions"
    ADD CONSTRAINT "token_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_transactions"
    ADD CONSTRAINT "token_transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."token_packages"("id");



CREATE POLICY "Enable insert for all users" ON "public"."lead_analyses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read for all users" ON "public"."lead_analyses" FOR SELECT USING (true);



ALTER TABLE "public"."lead_analyses" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."is_within_radius"("p_latitude" numeric, "p_longitude" numeric, "p_radius_meters" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_within_radius"("p_latitude" numeric, "p_longitude" numeric, "p_radius_meters" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_within_radius"("p_latitude" numeric, "p_longitude" numeric, "p_radius_meters" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_location"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_location"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_location"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_proximity"("p_latitude" numeric, "p_longitude" numeric, "p_acceptable_radius_meters" integer, "p_max_uber_distance_km" integer, "p_max_coverage_km" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_proximity"("p_latitude" numeric, "p_longitude" numeric, "p_acceptable_radius_meters" integer, "p_max_uber_distance_km" integer, "p_max_coverage_km" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_proximity"("p_latitude" numeric, "p_longitude" numeric, "p_acceptable_radius_meters" integer, "p_max_uber_distance_km" integer, "p_max_coverage_km" integer) TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_history" TO "anon";
GRANT ALL ON TABLE "public"."chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."token_balances" TO "anon";
GRANT ALL ON TABLE "public"."token_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."token_balances" TO "service_role";



GRANT ALL ON TABLE "public"."token_transactions" TO "anon";
GRANT ALL ON TABLE "public"."token_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."token_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."client_token_summary" TO "anon";
GRANT ALL ON TABLE "public"."client_token_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."client_token_summary" TO "service_role";



GRANT ALL ON TABLE "public"."control_points" TO "anon";
GRANT ALL ON TABLE "public"."control_points" TO "authenticated";
GRANT ALL ON TABLE "public"."control_points" TO "service_role";



GRANT ALL ON SEQUENCE "public"."control_points_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."control_points_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."control_points_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lead_analyses" TO "anon";
GRANT ALL ON TABLE "public"."lead_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leads_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."token_packages" TO "anon";
GRANT ALL ON TABLE "public"."token_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."token_packages" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







