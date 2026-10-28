import { Link } from 'react-router-dom'
import { IconLock } from '../components/Icons'
import { BTN } from '../components/feedback'

export default function NoPermissions() {
  return (
    <div className="grid place-items-center pt-10">
      <div className="w-full max-w-[520px] rounded-card bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-ctl bg-sunken text-ink-soft">
          <IconLock size={26} />
        </div>
        <h1 className="text-[24px] font-extrabold leading-8">Sin permisos</h1>
        <p className="mt-2 text-body text-ink-soft">
          Tu rol, Legal ESVAL, tiene acceso de solo lectura y no puede abrir esta sección. Las alertas y los parámetros los opera el Analista PMO de H2D.
        </p>
        <Link to="/" className={`${BTN.primary} mt-6 hover:text-white`}>Volver al resumen</Link>
      </div>
    </div>
  )
}
