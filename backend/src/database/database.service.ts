import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');

    if (supabaseServiceKey) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      console.log('✅ Supabase admin client initialized');
    }
  }

  /**
   * Cliente con la clave pública (anon): queda sujeto a RLS.
   * El backend NO debe usarlo para leer ni escribir datos de negocio; usar getAdminClient().
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /** Cliente con la service role: el backend es de confianza y no depende de políticas RLS. */
  getAdminClient(): SupabaseClient {
    if (!this.supabaseAdmin) {
      throw new Error('Supabase admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
    }
    return this.supabaseAdmin;
  }
}
