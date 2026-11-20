import { Download } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { planToExport } from '../../lib/budgetPlan'
import { PlanImporter } from './PlanImporter'

// Descarga un texto como archivo local.
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function PlanBackupCard({ plan, onImport }) {
  return (
    <Card className="p-4">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-ink">Respaldo del plan</h3>
        <p className="text-xs text-muted">
          Descarga el plan como archivo, o impórtalo desde uno (reemplaza el actual).
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3 px-1">
        <Button
          type="button"
          variant="secondary"
          onClick={() => downloadText('plan-presupuesto.json', JSON.stringify(planToExport(plan), null, 2))}
        >
          <Download className="h-4 w-4" />
          Exportar plan
        </Button>
        <PlanImporter existingLines={plan.lines.length} onImport={onImport} />
      </div>
    </Card>
  )
}
