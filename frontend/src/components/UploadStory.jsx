import React, { useState } from 'react';
import { X, Plus, Minus, Upload, ChevronDown } from 'lucide-react';
import { ALCOHOL_TYPES } from '../utils';
import { useLang } from '../context/LangContext';
import api from '../api';

const EMPTY_INGREDIENT = { name: '', amount: '', unit: 'ml' };

export default function UploadStory({ onClose, onUploaded }) {
  const { t } = useLang();
  const [step, setStep] = useState(1);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [form, setForm] = useState({
    cocktail_name: '',
    description: '',
    alcohol_types: [],
    ingredients: [{ ...EMPTY_INGREDIENT }],
    instructions: [''],
    food_pairing: '',
    difficulty: 'medium',
    prep_time: '5',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleAlcohol = (key) => {
    setForm(f => ({
      ...f,
      alcohol_types: f.alcohol_types.includes(key)
        ? f.alcohol_types.filter(a => a !== key)
        : [...f.alcohol_types, key],
    }));
  };

  const setIngredient = (i, k, v) => {
    setForm(f => {
      const arr = [...f.ingredients];
      arr[i] = { ...arr[i], [k]: v };
      return { ...f, ingredients: arr };
    });
  };

  const addIngredient = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { ...EMPTY_INGREDIENT }] }));
  const removeIngredient = (i) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  const setInstruction = (i, v) => {
    setForm(f => {
      const arr = [...f.instructions];
      arr[i] = v;
      return { ...f, instructions: arr };
    });
  };
  const addInstruction = () => setForm(f => ({ ...f, instructions: [...f.instructions, ''] }));
  const removeInstruction = (i) => setForm(f => ({ ...f, instructions: f.instructions.filter((_, idx) => idx !== i) }));

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!form.cocktail_name.trim()) return setError('Cocktail name is required');
    if (form.alcohol_types.length === 0) return setError('Select at least one alcohol type');
    if (form.ingredients.some(i => !i.name.trim())) return setError('Fill all ingredient names');
    if (form.instructions.some(s => !s.trim())) return setError('Fill all instruction steps');

    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      if (image) fd.append('image', image);
      fd.append('cocktail_name', form.cocktail_name);
      fd.append('description', form.description);
      fd.append('alcohol_types', JSON.stringify(form.alcohol_types));
      fd.append('ingredients', JSON.stringify(form.ingredients));
      fd.append('instructions', JSON.stringify(form.instructions));
      fd.append('food_pairing', form.food_pairing);
      fd.append('difficulty', form.difficulty);
      fd.append('prep_time', form.prep_time);

      await api.post('/stories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUploaded?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end"
         style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
                  maxWidth: '480px', left: '50%', transform: 'translateX(-50%)' }}>
      <div className="w-full rounded-t-3xl slide-up overflow-hidden"
           style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={22} /></button>
          <h2 className="font-bold text-white">{t('newStory')}</h2>
          <div className="flex gap-1">
            {[1,2,3].map(s => (
              <div key={s} className="w-2 h-2 rounded-full transition-all"
                   style={{ background: step >= s ? '#8b5cf6' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 70px)' }}>

          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="p-5 space-y-4 fade-in">
              <p className="text-white/40 text-sm">{t('stepBasic')}</p>

              {/* Image */}
              <label className="block cursor-pointer">
                <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
                     style={{ aspectRatio: '4/3', background: imagePreview ? 'transparent' : 'rgba(255,255,255,0.04)', border: '2px dashed rgba(255,255,255,0.1)' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-white/30">
                      <Upload size={32} />
                      <span className="text-sm">{t('addPhoto')}</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </label>

              <input type="text" placeholder={t('cocktailName')} value={form.cocktail_name} onChange={set('cocktail_name')} />
              <textarea placeholder={t('description')} value={form.description} onChange={set('description')} rows={2} style={{ resize: 'none' }} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">{t('difficulty')}</label>
                  <select
                    value={form.difficulty}
                    onChange={set('difficulty')}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="easy">{t('easy')}</option>
                    <option value="medium">{t('medium')}</option>
                    <option value="hard">{t('hard')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">{t('prepTime')}</label>
                  <input type="number" min="1" max="60" value={form.prep_time} onChange={set('prep_time')} />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/40 mb-2 block">{t('alcoholTypes')}</label>
                <div className="flex flex-wrap gap-2">
                  {ALCOHOL_TYPES.map(a => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => toggleAlcohol(a.key)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                      style={form.alcohol_types.includes(a.key)
                        ? { background: `${a.color}33`, color: a.color, border: `1px solid ${a.color}66` }
                        : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
              )}

              <button className="btn-primary w-full py-3" style={{ borderRadius: '14px' }}
                      onClick={() => {
                        if (!form.cocktail_name.trim()) return setError('Cocktail name required');
                        if (form.alcohol_types.length === 0) return setError('Select at least one alcohol type');
                        setError(''); setStep(2);
                      }}>
                {t('next')}
              </button>
            </div>
          )}

          {/* Step 2: Ingredients & instructions */}
          {step === 2 && (
            <div className="p-5 space-y-5 fade-in">
              <p className="text-white/40 text-sm">{t('stepRecipe')}</p>

              {/* Ingredients */}
              <div>
                <label className="text-sm font-semibold text-purple-400 mb-3 block">{t('ingredients')}</label>
                <div className="space-y-2">
                  {form.ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" placeholder={t('ingredient')} value={ing.name}
                             onChange={e => setIngredient(i, 'name', e.target.value)}
                             style={{ flex: 2 }} />
                      <input type="text" placeholder="Amt" value={ing.amount}
                             onChange={e => setIngredient(i, 'amount', e.target.value)}
                             style={{ flex: 1, minWidth: 0 }} />
                      <select value={ing.unit} onChange={e => setIngredient(i, 'unit', e.target.value)}
                              className="px-2 py-2 rounded-xl text-sm text-white"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', flex: 1, minWidth: 0 }}>
                        {['ml','cl','oz','dash','tsp','tbsp','piece','leaves','cup'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      {form.ingredients.length > 1 && (
                        <button onClick={() => removeIngredient(i)} className="text-white/30 hover:text-red-400 flex-shrink-0">
                          <Minus size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addIngredient}
                        className="mt-2 flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                  <Plus size={14} /> {t('addIngredient')}
                </button>
              </div>

              {/* Instructions */}
              <div>
                <label className="text-sm font-semibold text-pink-400 mb-3 block">{t('instructions')}</label>
                <div className="space-y-2">
                  {form.instructions.map((instrStep, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-purple-400 font-bold text-sm mt-2.5 w-5 flex-shrink-0">{i+1}.</span>
                      <textarea
                        placeholder={`${t('step')} ${i+1}...`}
                        value={instrStep}
                        onChange={e => setInstruction(i, e.target.value)}
                        rows={2}
                        style={{ resize: 'none', flex: 1 }}
                      />
                      {form.instructions.length > 1 && (
                        <button onClick={() => removeInstruction(i)} className="text-white/30 hover:text-red-400 mt-2">
                          <Minus size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addInstruction}
                        className="mt-2 flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300">
                  <Plus size={14} /> {t('addStep')}
                </button>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-2xl text-white/50 font-semibold"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                        onClick={() => setStep(1)}>{t('back')}</button>
                <button className="btn-primary flex-1 py-3" style={{ borderRadius: '14px' }}
                        onClick={() => { setError(''); setStep(3); }}>
                  {t('next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Food pairing + publish */}
          {step === 3 && (
            <div className="p-5 space-y-4 fade-in">
              <p className="text-white/40 text-sm">{t('stepFinish')}</p>

              <div>
                <label className="text-sm font-semibold text-amber-400 mb-1 block">{t('foodPairing')}</label>
                <textarea
                  placeholder={t('foodPairingPlaceholder')}
                  value={form.food_pairing}
                  onChange={set('food_pairing')}
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Summary */}
              <div className="rounded-2xl p-4 space-y-2"
                   style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <p className="font-bold text-white">{form.cocktail_name}</p>
                <p className="text-white/50 text-sm">{form.alcohol_types.join(', ')} · {form.difficulty} · {form.prep_time} min</p>
                <p className="text-white/40 text-sm">{form.ingredients.length} {t('ingredients').toLowerCase()} · {form.instructions.length} {t('step').toLowerCase()}s</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-2xl text-white/50 font-semibold"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                        onClick={() => setStep(2)}>{t('back')}</button>
                <button className="btn-primary flex-1 py-3" style={{ borderRadius: '14px' }}
                        disabled={loading} onClick={handleSubmit}>
                  {loading ? t('posting') : t('shareBtn')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
