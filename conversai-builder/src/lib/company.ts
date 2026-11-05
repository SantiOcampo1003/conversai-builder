/**
 * Datos legales de la empresa que presta el servicio.
 * Razón social, NIT y dirección deben coincidir EXACTAMENTE con el certificado de Cámara de
 * Comercio, y el teléfono con el del portafolio de Meta: Meta los compara con el sitio web al
 * verificar el negocio.
 */
export const COMPANY = {
  brand: 'EasyAgents',
  legalName: 'FRACTAL TEAM SOFTWARE COMPANY SAS',
  nit: '901.428.550-6',
  address: 'Cr 78 No. 8 A 25, Bogotá D.C., Colombia',
  phone: '+57 314 242 8602',
  phoneHref: 'tel:+573142428602',
  email: 'easy.development.tech@gmail.com',
  website: 'https://www.easyagent.space',
} as const

/** Fecha de la última actualización de los documentos legales. */
export const LEGAL_UPDATED_AT = '5 de noviembre de 2026'
