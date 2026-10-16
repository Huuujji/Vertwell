import { useEffect, useRef, useState } from 'react';
import type { ModifierTemplate, StockItem } from '../data/demo';
import { manilaTime, money } from '../data/demo';
import { modifierError } from '../data/modifiers';
import { ModifierFields } from './ModifierFields';
import SearchField from './SearchField';
import { useViewState } from '../lib/view-state';
import { Actions, Modal } from './ui';

interface Props {
  templates: ModifierTemplate[]; items: StockItem[]; actor: string;
  onSave: (template: ModifierTemplate) => void; onRemove: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void; onEditingChange: (editing: boolean) => void; onLeave: (action: () => void) => void;
}
export default function ModifierLibrary({ templates, items, actor, onSave, onRemove, onDirtyChange, onEditingChange, onLeave }: Props) {
  const [search, setSearch] = useViewState('Inventory.modifierSearch', '');
  const [draft, setDraft] = useState<ModifierTemplate | null>(null);
  const [dirty, setDirty] = useState(false); const [error, setError] = useState('');
  const [removing, setRemoving] = useState<ModifierTemplate | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const submitted = useRef(false);
  useEffect(() => { onEditingChange(Boolean(draft)); return () => onEditingChange(false); }, [Boolean(draft), onEditingChange]);
  useEffect(() => {
    onDirtyChange(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    if (dirty) window.addEventListener('beforeunload', beforeUnload);
    return () => { onDirtyChange(false); window.removeEventListener('beforeunload', beforeUnload); };
  }, [dirty, onDirtyChange]);
  function open(template?: ModifierTemplate) {
    setDraft(template ? structuredClone(template) : { id: crypto.randomUUID(), name: '', min: 0, max: 1, options: [] });
    setDirty(false); setError(''); submitted.current = false;
  }
  function cancel() { onLeave(() => { setDraft(null); setDirty(false); requestAnimationFrame(() => addButton.current?.focus()); }); }
  if (draft) return <section className="add-product modifier-library-editor"><div className="page-heading"><div><h1>{templates.some(template => template.id === draft.id) ? 'Edit modifier group' : 'Add modifier group'}</h1><p className="subtitle">Reusable choices · sample library</p></div><button className="secondary" onClick={cancel}>Back to modifier groups</button></div>
    <p className="inventory-editor-note">Products receive independent copies. Saving here does not update groups already added to products, cart lines, or recorded sales. Negative stock quantities remove ingredients from the product recipe; check each product before use.</p>
    <form onSubmit={event => {
      event.preventDefault(); if (submitted.current) return;
      const problem = modifierError(draft, items);
      if (problem) { setError(problem); return; }
      if (templates.some(template => template.id !== draft.id && template.name.trim().toLowerCase() === draft.name.trim().toLowerCase())) { setError('A library group with this name already exists.'); return; }
      submitted.current = true;
      onSave({ ...draft, name: draft.name.trim(), options: draft.options.map(option => ({ ...option, name: option.name.trim() })), editedBy: actor, editedAt: new Date().toISOString() });
      onDirtyChange(false); setDirty(false); setDraft(null); setSearch(''); requestAnimationFrame(() => addButton.current?.focus());
    }}><div className="editor-sections"><section className="modifier-editor"><h2>Group choices and defaults</h2><p className="subtitle">Defaults are selected for new POS customizations. Customers can change them; stock and choice limits still apply. Required groups may leave all defaults off for an explicit choice.</p><ModifierFields focusName group={draft} items={items} onChange={group => { setDraft({ ...draft, ...group }); setDirty(true); setError(''); }} /></section></div>
      {error && <p className="error" role="alert">{error}</p>}<Actions><button className="secondary" type="button" onClick={cancel}>Cancel</button><button className="primary">Save group</button></Actions></form></section>;
  const query = search.trim().toLowerCase();
  const matches = templates.filter(template => `${template.name} ${template.options.map(option => option.name).join(' ')}`.toLowerCase().includes(query));
  return <section className="modifier-library" aria-label="Reusable modifier groups"><div className="page-heading"><div><h2>Reusable modifier groups</h2><p className="subtitle">Save choices once, then add a copy to any product. Library changes do not update existing copies. Sample data resets on refresh.</p></div><button ref={addButton} className="accent" onClick={() => open()}>Add library group</button></div>
    <SearchField label="Search modifier groups" placeholder="Search group or option name" value={search} onChange={setSearch} /><p className="filter-summary" role="status">{matches.length} of {templates.length} library groups{query ? ` matching “${search.trim()}”` : ''}</p>
    <div className="modifier-library-list">{matches.map(template => <article key={template.id} aria-label={`${template.name} library group`}><h3>{template.name}</h3><p>{template.min ? 'Required' : 'Optional'} · Choose {template.min}–{template.max} · {template.options.length} options</p><ul>{template.options.map(option => <li key={option.id}><span>{option.name}{option.defaultSelected ? ' · Default' : ''}</span><strong>{option.price ? `+${money(option.price)}` : 'No charge'}</strong></li>)}</ul>
      {template.editedAt && <p className="field-hint">Saved by {template.editedBy} · {manilaTime(template.editedAt)}</p>}<Actions><button className="secondary" aria-label={`Edit library group ${template.name}`} onClick={() => open(template)}>Edit group</button><button className="danger-button" aria-label={`Remove library group ${template.name}`} onClick={() => { submitted.current = false; setRemoving(template); }}>Remove group</button></Actions></article>)}</div>
    {!matches.length && <div className="empty-state"><p>{templates.length ? 'No library groups match your search.' : 'No reusable groups yet. Add a group here, or save a product group to the library.'}</p>{query && <button className="secondary" onClick={() => setSearch('')}>Clear group search</button>}</div>}
    {removing && <Modal title="Remove library group?" onClose={() => setRemoving(null)}><p>Remove {removing.name} from the sample library? Existing product copies, cart lines, and recorded sales keep their choices.</p><Actions><button className="secondary" data-initial-focus onClick={() => setRemoving(null)}>Keep group</button><button className="danger-button" onClick={() => { if (submitted.current) return; submitted.current = true; onRemove(removing.id); setRemoving(null); requestAnimationFrame(() => addButton.current?.focus()); }}>Remove from library</button></Actions></Modal>}
  </section>;
}
