import React, { useState, useEffect } from 'react';
import { Check, Wine, Plus, Trash2, X } from 'lucide-react';
import { ALCOHOL_TYPES } from '../utils';
import { useLang } from '../context/LangContext';
import api from '../api';

const PRESET_COLORS = ['#8b5cf6','#ec4899','#10b981','#3b82f6','#f59e0b','#ef4444','#06b6d4','#f97316'];

export default function MyBar({ onClose }) {
  const { t, lang } = useLang();
  const [selected, setSelected] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);
  const [hiddenKeys, setHiddenKeys] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmoji, setNewEmoji] = useState('🍸');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/users/me/bar'),
      api.get('/users/me/custom-alcohols'),
    ]).then(([barRes, customRes]) => {
      setSelected(barRes.data);
      setCustomTypes(customRes.data.custom);
      setHiddenKeys(customRes.data.hidden);
    });
  }, []);

  const allTypes = [
    ...ALCOHOL_TYPES.filter(a => !hiddenKeys.includes(a.key)),
    ...customTypes,
  ];

  const toggle = (key) => {
    if (removeMode) return;
    setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);
    setSaved(false);
  };

  const handleRemoveType = async (key) => {
    await api.delete(`/users/me/custom-alcohols/${key}`);
    setSelected(s => s.filter(k => k !== key));
    if (customTypes.find(c => c.key === key)) {
      setCustomTypes(prev => prev.filter(c => c.key !== key));
    } else {
      setHiddenKeys(prev => [...prev, key]);
    }
  };

  const handleAddType = async () => {
    if (!newLabel.trim()) return setAddError(lang === 'he' ? 'חובה להזין שם' : 'Name required');
    try {
      const res = await api.post('/users/me/custom-alcohols', { label: newLabel.trim(), emoji: newEmoji, color: newColor });
      setCustomTypes(prev => [...prev, res.data]);
      setNewLabel(''); setNewEmoji('🍸'); setNewColor('#8b5cf6');
      setAddError(''); setShowAddForm(false);
    } catch { setAddError(lang === 'he' ? 'שגיאה בהוספה' : 'Failed to add'); }
  };

  const handleSave = async () => {
    setSaving(true);
    await api.put('/users/me/bar', { alcohol_types: selected });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose?.(); }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end"
         style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
                  maxWidth: '480px', left: '50%', transform: 'translateX(-50%)' }}
         onClick={onClose}>
      <div className="w-full rounded-t-3xl slide-up"
           style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Wine size={20} className="text-purple-400" />
            <h2 className="font-bold text-white">{t('myBarTitle')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
                {selected.length} {t('spirits')}
              </span>
            )}
            <button
              onClick={() => { setRemoveMode(r => !r); setShowAddForm(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={removeMode
                ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Trash2 size={12} />
              {lang === 'he' ? 'הסר' : 'Remove'}
            </button>
          </div>
        </div>

        {/* Hint */}
        {!removeMode && !showAddForm && (
          <div className="px-5 pt-3 pb-1 flex-shrink-0">
            <p className="text-white/40 text-sm">{t('myBarHint')}</p>
          </div>
        )}

        {/* Remove mode banner */}
        {removeMode && (
          <div className="px-5 py-2 flex-shrink-0">
            <p className="text-red-400/70 text-sm">{lang === 'he' ? 'לחץ על משקה להסרתו מהרשימה שלך' : 'Tap a drink to remove it from your list'}</p>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="px-5 py-3 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2 mb-3">
              <input
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value)}
                maxLength={2}
                style={{ width: 52, textAlign: 'center', fontSize: '20px', padding: '8px 6px', flexShrink: 0 }}
                placeholder="🍸"
              />
              <input
                value={newLabel}
                onChange={e => { setNewLabel(e.target.value); setAddError(''); }}
                placeholder={lang === 'he' ? 'שם המשקה' : 'Drink name'}
                style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && handleAddType()}
              />
            </div>
            <div className="flex gap-2 mb-3">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: c, flexShrink: 0,
                    border: newColor === c ? '2px solid white' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
            {addError && <p className="text-red-400 text-xs mb-2">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddType}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
                {lang === 'he' ? 'הוסף' : 'Add'}
              </button>
              <button onClick={() => { setShowAddForm(false); setAddError(''); }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Pills */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-2">
            {allTypes.map(a => {
              const isSelected = selected.includes(a.key);
              const label = lang === 'he' ? (a.labelHe || a.label) : a.label;
              return (
                <button
                  key={a.key}
                  onClick={() => removeMode ? handleRemoveType(a.key) : toggle(a.key)}
                  className="flex items-center gap-1.5 rounded-full font-semibold transition-all"
                  style={{
                    padding: '7px 14px', fontSize: '13px',
                    ...(removeMode
                      ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                      : isSelected
                        ? { background: `${a.color}22`, border: `1px solid ${a.color}55`, color: a.color }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' })
                  }}
                >
                  <span>{a.emoji}</span>
                  <span>{label}</span>
                  {removeMode ? <X size={11} /> : isSelected && <Check size={12} style={{ color: a.color }} />}
                </button>
              );
            })}

            {/* Add button */}
            {!removeMode && (
              <button
                onClick={() => { setShowAddForm(s => !s); setRemoveMode(false); }}
                className="flex items-center gap-1.5 rounded-full font-semibold transition-all"
                style={{
                  padding: '7px 14px', fontSize: '13px',
                  background: showAddForm ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                  border: showAddForm ? '1px solid rgba(139,92,246,0.35)' : '1px dashed rgba(255,255,255,0.2)',
                  color: showAddForm ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Plus size={13} />
                {lang === 'he' ? 'הוסף משקה' : 'Add Drink'}
              </button>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {removeMode ? (
            <button
              onClick={() => setRemoveMode(false)}
              className="btn-primary w-full py-3"
              style={{ borderRadius: '14px' }}
            >
              {lang === 'he' ? 'סיום הסרה' : 'Done Removing'}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full py-3"
              style={{ borderRadius: '14px' }}
            >
              {saved ? '✓' : saving ? '...' : t('saveBar')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
