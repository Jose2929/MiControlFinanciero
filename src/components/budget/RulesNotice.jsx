import { AlertCircle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

// Debe coincidir con el bloque "budget" de database.rules.json (hay una prueba
// que lo comprueba).
export const RULE_SNIPPET = `"budget": {
  ".read": "auth != null && root.child('households/' + $hid + '/members/' + auth.uid).exists()",
  ".write": "auth != null && root.child('households/' + $hid + '/members/' + auth.uid).exists()"
}`

// Se muestra cuando Firebase rechaza leer households/{hid}/budget: casi
// siempre es que la regla del nodo todavía no está publicada en la consola.
export function RulesNotice() {
  return (
    <Card className="space-y-3 p-5">
      <Badge variant="warning" icon={AlertCircle}>
        Falta un paso en Firebase
      </Badge>
      <p className="text-sm text-ink">
        Firebase no deja leer el plan del presupuesto todavía. Hay que publicar su regla una sola vez.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Abre la consola de Firebase → Realtime Database → Reglas.</li>
        <li>
          Dentro de <span className="font-medium text-ink">households → $hid</span>, junto a{' '}
          <span className="font-medium text-ink">profile</span>, agrega este bloque (ya está en{' '}
          <span className="font-medium text-ink">database.rules.json</span>).
        </li>
        <li>Pulsa Publicar y recarga esta pantalla.</li>
      </ol>
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface2 p-3 text-xs text-ink">
        {RULE_SNIPPET}
      </pre>
    </Card>
  )
}
