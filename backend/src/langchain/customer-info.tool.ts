import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';

/**
 * Creates a dynamic tool for saving customer information
 * Adapts to the agent's required_info configuration
 */
export function createCustomerInfoTool(
  databaseService: DatabaseService,
  agentId: string,
  customerId: string, // WhatsApp phone number
  requiredInfo: string[] = [],
) {
  // Build dynamic schema based on required_info
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  // Map Spanish field names to schema
  const fieldMapping: Record<string, { key: string; type: z.ZodTypeAny; description: string }> = {
    'nombre': { key: 'nombre', type: z.string(), description: 'Nombre completo del cliente' },
    'telefono': { key: 'telefono', type: z.string(), description: 'Número de teléfono' },
    'email': { key: 'email', type: z.string().email(), description: 'Correo electrónico' },
    'direccion': { key: 'direccion', type: z.string(), description: 'Dirección física' },
    'ciudad': { key: 'ciudad', type: z.string(), description: 'Ciudad de residencia' },
    'edad': { key: 'edad', type: z.number().int().positive(), description: 'Edad en años' },
    'presupuesto': { key: 'presupuesto', type: z.string(), description: 'Presupuesto o rango de precio' },
    'empresa': { key: 'empresa', type: z.string(), description: 'Nombre de la empresa' },
    'cargo': { key: 'cargo', type: z.string(), description: 'Cargo o posición' },
  };

  // Add fields based on required_info
  if (requiredInfo.length > 0) {
    requiredInfo.forEach((field) => {
      const normalizedField = field.toLowerCase().trim();
      const mapping = fieldMapping[normalizedField];

      if (mapping) {
        schemaFields[mapping.key] = mapping.type.optional();
      } else {
        // Generic string field for custom fields
        schemaFields[normalizedField] = z.string().optional();
      }
    });
  } else {
    // If no required_info, allow all common fields
    Object.values(fieldMapping).forEach((mapping) => {
      schemaFields[mapping.key] = mapping.type.optional();
    });
  }

  // Ensure at least one field is provided
  const schema = z.object(schemaFields).refine(
    (data) => Object.values(data).some((value) => value !== undefined && value !== null && value !== ''),
    { message: 'Al menos un campo debe tener un valor' }
  );

  return new DynamicStructuredTool({
    name: 'save_customer_info',
    description: `Guarda o actualiza información del cliente cuando la detectes en la conversación.
Campos disponibles según configuración del agente: ${requiredInfo.join(', ') || 'todos los campos comunes'}.
Usa esta herramienta SOLO cuando el cliente proporcione información personal clara y verificable.
Ejemplos:
- Cliente: "Mi nombre es Juan Pérez" → save_customer_info({nombre: "Juan Pérez"})
- Cliente: "Vivo en Medellín" → save_customer_info({ciudad: "Medellín"})
- Cliente: "Tengo un presupuesto de 5 millones" → save_customer_info({presupuesto: "5 millones"})`,
    schema,
    func: async (input: Record<string, any>) => {
      try {
        const supabase = databaseService.getClient();

        // Check if lead already exists
        const { data: existingLead, error: fetchError } = await supabase
          .from('leads')
          .select('id, additional_fields')
          .eq('agent_id', agentId)
          .eq('customer_id', customerId)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching lead:', fetchError);
          return `Error al buscar información del cliente: ${fetchError.message}`;
        }

        // Merge new data with existing
        const currentFields = existingLead?.additional_fields || {};
        const updatedFields = { ...currentFields, ...input };

        if (existingLead) {
          // Update existing lead
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              additional_fields: updatedFields,
              updated_at: new Date().toISOString(),
              status: 'contacted', // Mark as contacted since we have interaction
            })
            .eq('id', existingLead.id);

          if (updateError) {
            console.error('Error updating lead:', updateError);
            return `Error al actualizar información: ${updateError.message}`;
          }

          return `Información del cliente actualizada correctamente. Campos guardados: ${Object.keys(input).join(', ')}`;
        } else {
          // Create new lead
          const { error: insertError } = await supabase
            .from('leads')
            .insert({
              agent_id: agentId,
              customer_id: customerId,
              additional_fields: updatedFields,
              status: 'new',
              source: 'whatsapp',
            });

          if (insertError) {
            console.error('Error creating lead:', insertError);
            return `Error al crear registro: ${insertError.message}`;
          }

          return `Nueva información del cliente guardada correctamente. Campos: ${Object.keys(input).join(', ')}`;
        }
      } catch (error) {
        console.error('Unexpected error in save_customer_info tool:', error);
        return `Error inesperado al guardar información del cliente`;
      }
    },
  });
}
