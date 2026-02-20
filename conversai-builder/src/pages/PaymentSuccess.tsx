import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const paymentId = searchParams.get('payment_id')
  const status = searchParams.get('status')
  const externalReference = searchParams.get('external_reference')

  useEffect(() => {
    // Log para debugging
    console.log('Payment Success - Payment ID:', paymentId)
    console.log('Payment Success - Status:', status)
    console.log('Payment Success - External Reference:', externalReference)
  }, [paymentId, status, externalReference])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          ¡Pago Exitoso!
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mb-6">
          Tu compra de tokens se ha procesado correctamente. Los tokens se acreditarán en tu cuenta en breve.
        </p>

        {/* Payment Info */}
        {paymentId && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <div className="text-xs text-muted-foreground mb-1">ID de Pago</div>
            <div className="text-sm font-mono text-foreground">{paymentId}</div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full"
          >
            Volver al Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
