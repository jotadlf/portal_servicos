import { useState, type InputHTMLAttributes } from 'react'
import { Eye as EyeOpen, EyeOff } from 'lucide-react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  // Mensagem do problema; com ela o campo ganha o contorno vermelho
  error?: string
  help?: string
}

export function Field({ label, name, error, help, ...input }: FieldProps) {
  // Campo de senha ganha o botão do olho para mostrar o que foi digitado
  const isPassword = input.type === 'password'
  const [visible, setVisible] = useState(false)
  const noteId = `${name}-nota`
  const note = error || help
  const control = (
    <input
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? noteId : undefined}
      {...input}
      type={isPassword && visible ? 'text' : input.type}
      onBlur={(event) => {
        // Tocar no olho não conta como sair do campo: não acusa erro antes da hora
        if (event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) return
        input.onBlur?.(event)
      }}
    />
  )
  const Eye = visible ? EyeOff : EyeOpen

  return (
    <label className="field">
      <span>{label}</span>
      {isPassword ? (
        <span className="password-input">
          {control}
          <button
            type="button"
            className="password-toggle"
            aria-label="Mostrar senha"
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            <Eye size={18} aria-hidden="true" />
          </button>
        </span>
      ) : (
        control
      )}
      {note && (
        <small id={noteId} className={error ? 'form-error' : 'field-help'}>
          {note}
        </small>
      )}
    </label>
  )
}
