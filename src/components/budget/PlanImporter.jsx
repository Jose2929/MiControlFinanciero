import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import { validatePlanInput } from '../../lib/budgetPlan'

const MAX_FILE_BYTES = 1024 * 1024

// Botón para importar un plan desde un archivo JSON. Valida antes de tocar
// nada: si el archivo trae errores los lista y no importa; si ya hay un plan,
// pide confirmación antes de reemplazarlo.
export function PlanImporter({ existingLines = 0, onImport, label = 'Importar plan', variant = 'secondary' }) {
  const inputRef = useRef(null)
  const [errors, setErrors] = useState([])
  const [pending, setPending] = useState(null) // plan válido que espera confirmación
  const [done, setDone] = useState('')

  function apply(plan) {
    onImport(plan)
    setPending(null)
    setDone(`Plan importado: ${plan.lines.length} renglones y ${plan.incomes.length} ingresos.`)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite elegir el mismo archivo otra vez
    if (!file) return
    setErrors([])
    setPending(null)
    setDone('')
    if (file.size > MAX_FILE_BYTES) {
      setErrors(['El archivo es demasiado grande para ser un plan de presupuesto.'])
      return
    }
    let text
    try {
      text = await file.text()
    } catch {
      setErrors(['No se pudo leer el archivo.'])
      return
    }
    const result = validatePlanInput(text)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    if (existingLines > 0) {
      setPending(result.plan)
      return
    }
    apply(result.plan)
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
      <Button type="button" variant={variant} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" />
        {label}
      </Button>

      {errors.length > 0 && (
        <div role="alert" className="mt-3 rounded-xl border border-negative/40 bg-negative-soft p-3 text-sm">
          <p className="font-medium text-negative">No se importó nada. Corrige el archivo:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {pending && (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
          <p className="font-medium text-ink">¿Reemplazar el plan actual?</p>
          <p className="mt-1 text-xs text-muted">
            Hoy tienes {existingLines} renglones; el archivo trae {pending.lines.length} renglones y{' '}
            {pending.incomes.length} ingresos. Lo actual se sustituye.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={() => apply(pending)}>
              Sí, reemplazar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {done && <p className="mt-3 text-xs font-medium text-positive">{done}</p>}
    </div>
  )
}
