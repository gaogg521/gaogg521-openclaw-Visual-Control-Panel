'use client'

import { useI18n } from '@/lib/i18n'

interface EditActionBarProps {
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onReset: () => void
}

const barBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: '12px',
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.7)',
  border: '2px solid #4a4a6a',
  borderRadius: 0,
  cursor: 'pointer',
}

const disabledBtnStyle: React.CSSProperties = {
  ...barBtnStyle,
  opacity: 0.3,
  cursor: 'default',
}

export function EditActionBar({ isDirty, canUndo, canRedo, onUndo, onRedo, onSave, onReset }: EditActionBarProps) {
  const { t } = useI18n()

  if (!isDirty && !canUndo && !canRedo) return null

  return (
    <div style={{
      position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
      background: '#1e1e2e', border: '2px solid #4a4a6a', borderRadius: 0,
      padding: '4px 8px', display: 'flex', gap: 4,
      boxShadow: '2px 2px 0px #0a0a14',
    }}>
      <button style={canUndo ? barBtnStyle : disabledBtnStyle} onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">
        {t('pixelOffice.undo')}
      </button>
      <button style={canRedo ? barBtnStyle : disabledBtnStyle} onClick={onRedo} disabled={!canRedo} title="Ctrl+Y">
        {t('pixelOffice.redo')}
      </button>
      {isDirty && (
        <>
          <button style={{ ...barBtnStyle, background: 'rgba(90, 140, 255, 0.25)', border: '2px solid #5a8cff' }} onClick={onSave}>
            {t('pixelOffice.save')}
          </button>
          <button style={barBtnStyle} onClick={onReset}>
            {t('pixelOffice.reset')}
          </button>
        </>
      )}
    </div>
  )
}
