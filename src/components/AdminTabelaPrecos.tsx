import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Search, Plus, Pencil, Trash2, Save, Download, Upload,
  ChevronLeft, ChevronRight, Loader2, TableProperties,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X, FileJson, Copy,
  BarChart3, MapPin, Route, DollarSign, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTabelaFromSupabase, syncCacheFromSupabase,
  addEntrySupabase, updateEntrySupabase, deleteEntrySupabase,
  deleteBulkSupabase, importTabelaSupabase, normalizeText, findEntryId,
  type TabelaEntry,
} from '@/lib/tabela-preco';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

type SortKey = 'origem' | 'destino' | 'valor' | 'regiao';
type SortDir = 'asc' | 'desc';

const AdminTabelaPrecos: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data from Supabase ──
  const { data: tabela = [], isLoading: loadingTabela } = useQuery({
    queryKey: ['tabela-precos'],
    queryFn: fetchTabelaFromSupabase,
  });

  // Sync cache on load
  useEffect(() => {
    if (!loadingTabela && tabela.length > 0) {
      syncCacheFromSupabase();
    }
  }, [loadingTabela, tabela.length]);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState<string>('_all');
  const [filterDestino, setFilterDestino] = useState<string>('_all');
  const [filterRegiao, setFilterRegiao] = useState<string>('_all');

  // ── Pagination ──
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // ── Sorting ──
  const [sortKey, setSortKey] = useState<SortKey>('origem');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Dialogs ──
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);

  // ── Form state ──
  const [formOrigem, setFormOrigem] = useState('');
  const [formDestino, setFormDestino] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formRegiao, setFormRegiao] = useState('Cabo');
  const [editingEntry, setEditingEntry] = useState<TabelaEntry | null>(null);
  const [editingOrigKey, setEditingOrigKey] = useState<{ origem: string; destino: string } | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TabelaEntry | null>(null);

  // ── Import state ──
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importData, setImportData] = useState<TabelaEntry[] | null>(null);
  const [importFileName, setImportFileName] = useState('');

  // ── Data ──
  const origens = useMemo(() => [...new Set(tabela.map(e => e.origem))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [tabela]);
  const regioes = useMemo(() => [...new Set(tabela.map(e => e.regiao))].sort(), [tabela]);
  const destinos = useMemo(() => {
    const base = filterOrigem !== '_all' ? tabela.filter(e => e.origem === filterOrigem) : tabela;
    return [...new Set(base.map(e => e.destino))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tabela, filterOrigem]);
  const stats = useMemo(() => ({
    totalRotas: tabela.length,
    totalOrigens: new Set(tabela.map(e => e.origem)).size,
    totalDestinos: new Set(tabela.map(e => e.destino)).size,
    precoMin: tabela.length ? Math.min(...tabela.map(e => e.valor)) : 0,
    precoMax: tabela.length ? Math.max(...tabela.map(e => e.valor)) : 0,
  }), [tabela]);

  // ── Filtering (normalized for accent-insensitive search) ──
  const filtered = useMemo(() => {
    let data = tabela;
    if (filterOrigem !== '_all') {
      data = data.filter(e => e.origem === filterOrigem);
    }
    if (filterDestino !== '_all') {
      data = data.filter(e => e.destino === filterDestino);
    }
    if (filterRegiao !== '_all') {
      data = data.filter(e => e.regiao === filterRegiao);
    }
    if (search.trim()) {
      const q = normalizeText(search);
      // Support searching "origem destino" simultaneously with space-separated terms
      const terms = q.split(' ').filter(t => t.length > 1);
      data = data.filter(e => {
        const combined = `${normalizeText(e.origem)} ${normalizeText(e.destino)} ${e.valor}`;
        return terms.every(t => combined.includes(t));
      });
    }
    return data;
  }, [tabela, filterOrigem, filterDestino, filterRegiao, search]);

  // ── Sorting ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'valor') {
        cmp = a.valor - b.valor;
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey], 'pt-BR');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // ── Pagination ──
  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);

  const entryKey = (e: TabelaEntry) => e.id || `${e.origem}||${e.destino}`;

  // ── Selection helpers ──
  const allPageSelected = pageData.length > 0 && pageData.every(e => selected.has(entryKey(e)));

  const toggleSelectAll = () => {
    const next = new Set(selected);
    if (allPageSelected) {
      pageData.forEach(e => next.delete(entryKey(e)));
    } else {
      pageData.forEach(e => next.add(entryKey(e)));
    }
    setSelected(next);
  };

  const toggleSelect = (e: TabelaEntry) => {
    const next = new Set(selected);
    const k = entryKey(e);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  // ── Sort toggle ──
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // ── Mutations ──
  const onMutationSuccess = async (msg: string) => {
    toast({ title: msg });
    await syncCacheFromSupabase();
    qc.invalidateQueries({ queryKey: ['tabela-precos'] });
  };

  const addMutation = useMutation({
    mutationFn: addEntrySupabase,
    onSuccess: () => { onMutationSuccess('Rota adicionada!'); setShowAddDialog(false); resetForm(); },
    onError: (e: any) => toast({ title: 'Erro ao adicionar', description: e?.message?.includes('duplicate') ? 'Essa combina\u00e7\u00e3o j\u00e1 existe.' : e?.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TabelaEntry> }) => updateEntrySupabase(id, updates),
    onSuccess: () => { onMutationSuccess('Rota atualizada!'); setShowEditDialog(false); resetForm(); },
    onError: (e: any) => toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntrySupabase,
    onSuccess: () => { onMutationSuccess('Rota removida!'); setShowDeleteDialog(false); setDeletingEntry(null); },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteBulkSupabase,
    onSuccess: (_, ids) => { onMutationSuccess(`${ids.length} rota(s) removida(s)`); setSelected(new Set()); setShowBulkDeleteDialog(false); },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }),
  });

  const importMutation = useMutation({
    mutationFn: ({ entries, replace }: { entries: TabelaEntry[]; replace: boolean }) => importTabelaSupabase(entries, replace),
    onSuccess: (result) => {
      onMutationSuccess(`Importa\u00e7\u00e3o: ${result.added} adicionadas, ${result.skipped} ignoradas`);
      setShowImportDialog(false); setImportData(null); setImportFileName(''); setPage(0);
    },
    onError: (e: any) => toast({ title: 'Erro na importa\u00e7\u00e3o', description: e?.message, variant: 'destructive' }),
  });

  // ── Add entry ──
  const handleAdd = () => {
    const valor = parseFloat(formValor.replace(',', '.'));
    if (!formOrigem.trim() || !formDestino.trim() || isNaN(valor) || valor <= 0) {
      toast({ title: 'Preencha todos os campos corretamente', variant: 'destructive' });
      return;
    }
    addMutation.mutate({ origem: formOrigem.trim(), destino: formDestino.trim(), valor, regiao: formRegiao.trim() || 'Cabo' });
  };

  // ── Edit entry ──
  const openEdit = (e: TabelaEntry) => {
    setEditingEntry(e);
    setEditingOrigKey({ origem: e.origem, destino: e.destino });
    setFormOrigem(e.origem);
    setFormDestino(e.destino);
    setFormValor(e.valor.toFixed(2));
    setFormRegiao(e.regiao);
    setShowEditDialog(true);
  };

  const handleEdit = async () => {
    let entryId = editingEntry?.id;
    // If no ID, look it up from Supabase by original origem+destino
    if (!entryId && editingOrigKey) {
      entryId = await findEntryId(editingOrigKey.origem, editingOrigKey.destino) || undefined;
    }
    if (!entryId) {
      toast({ title: 'Erro: entrada sem ID', description: 'Não foi possível identificar a rota. Tente recarregar a página.', variant: 'destructive' });
      return;
    }
    const valor = parseFloat(formValor.replace(',', '.'));
    if (!formOrigem.trim() || !formDestino.trim() || isNaN(valor) || valor <= 0) {
      toast({ title: 'Preencha todos os campos corretamente', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({
      id: entryId,
      updates: { origem: formOrigem.trim(), destino: formDestino.trim(), valor, regiao: formRegiao.trim() || 'Cabo' },
    });
  };

  // ── Delete single ──
  const openDelete = (e: TabelaEntry) => { setDeletingEntry(e); setShowDeleteDialog(true); };

  const handleDelete = () => {
    if (!deletingEntry?.id) return;
    deleteMutation.mutate(deletingEntry.id);
  };

  // ── Bulk delete ──
  const handleBulkDelete = () => {
    const ids: string[] = [];
    for (const key of selected) {
      const entry = tabela.find(e => entryKey(e) === key);
      if (entry?.id) ids.push(entry.id);
    }
    if (ids.length === 0) return;
    bulkDeleteMutation.mutate(ids);
  };

  // ── Export ──
  const handleExport = () => {
    const json = JSON.stringify(tabela.map(({ id, ...rest }) => rest), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TabelaPrecos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Tabela exportada!' });
  };

  // ── Import ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(raw)) throw new Error('not array');
        const valid = raw.filter((x: unknown) =>
          !!x && typeof x === 'object' &&
          'origem' in x && 'destino' in x && 'valor' in x
        );
        setImportData(valid as TabelaEntry[]);
      } catch {
        toast({ title: 'Arquivo JSON inválido', variant: 'destructive' });
        setImportData(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = () => {
    if (!importData) return;
    importMutation.mutate({ entries: importData, replace: importMode === 'replace' });
  };

  const resetForm = () => {
    setFormOrigem('');
    setFormDestino('');
    setFormValor('');
    setFormRegiao('Cabo');
    setEditingEntry(null);
    setEditingOrigKey(null);
  };

  // ── Autocomplete suggestions for form fields ──
  const allLocations = useMemo(() => {
    const set = new Set<string>();
    for (const e of tabela) { set.add(e.origem); set.add(e.destino); }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tabela]);

  const AutocompleteInput = ({ value, onChange, placeholder, label }: {
    value: string; onChange: (v: string) => void; placeholder?: string; label: string;
  }) => {
    const [open, setOpen] = useState(false);
    const suggestions = useMemo(() => {
      if (!value.trim() || value.length < 2) return [];
      const q = normalizeText(value);
      return allLocations.filter(l => normalizeText(l).includes(q)).slice(0, 8);
    }, [value]);

    return (
      <div className="relative">
        <Label className="text-xs">{label}</Label>
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/10 transition-colors"
                onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  if (loadingTabela) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-muted-foreground text-sm">Carregando tabela de preços...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Compact summary ── */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
          <span className="flex items-center gap-1 sm:gap-1.5 font-medium">
            <Route className="w-3.5 h-3.5 text-accent" />
            {stats.totalRotas.toLocaleString('pt-BR')} rotas
          </span>
          <span className="text-muted-foreground hidden sm:inline">{stats.totalOrigens} origens</span>
          <span className="text-muted-foreground">R$ {stats.precoMin.toFixed(0)}–{stats.precoMax.toFixed(0)}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setShowStatsDialog(true)}>
          <BarChart3 className="w-3 h-3" /> Detalhes
        </Button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar origem, destino ou valor..."
              className="pl-10 h-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
          <Select value={filterOrigem} onValueChange={(v) => { setFilterOrigem(v); setFilterDestino('_all'); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="_all">Todas origens</SelectItem>
              {origens.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDestino} onValueChange={(v) => { setFilterDestino(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Destino" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="_all">Todos destinos</SelectItem>
              {destinos.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(filterOrigem !== '_all' || filterDestino !== '_all' || filterRegiao !== '_all' || search) && (
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-muted-foreground" onClick={() => {
              setFilterOrigem('_all'); setFilterDestino('_all'); setFilterRegiao('_all'); setSearch(''); setPage(0);
            }}>
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
          <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" /> Rota
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setImportData(null); setImportFileName(''); setShowImportDialog(true); }} className="gap-1.5 h-8">
            <Upload className="w-3.5 h-3.5" /> Importar
          </Button>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {filtered.length !== tabela.length ? `${filtered.length} de ${tabela.length}` : `${tabela.length}`} rota(s)
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th
                  className="py-2 px-3 text-left font-medium cursor-pointer hover:text-accent transition-colors"
                  onClick={() => toggleSort('origem')}
                >
                  <span className="flex items-center gap-1">Origem <SortIcon col="origem" /></span>
                </th>
                <th
                  className="py-2 px-3 text-left font-medium cursor-pointer hover:text-accent transition-colors"
                  onClick={() => toggleSort('destino')}
                >
                  <span className="flex items-center gap-1">Destino <SortIcon col="destino" /></span>
                </th>
                <th
                  className="py-2 px-3 text-right font-medium cursor-pointer hover:text-accent transition-colors w-24"
                  onClick={() => toggleSort('valor')}
                >
                  <span className="flex items-center gap-1 justify-end">Valor <SortIcon col="valor" /></span>
                </th>
                <th className="py-2 px-3 w-16 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">
                    {search || filterOrigem !== '_all' ? 'Nenhuma rota encontrada.' : 'Tabela vazia.'}
                  </td>
                </tr>
              ) : (
                pageData.map((entry) => {
                  const k = entryKey(entry);
                  return (
                    <tr key={k} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-1.5 px-3 font-medium text-xs">{entry.origem}</td>
                      <td className="py-1.5 px-3 text-xs">{entry.destino}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-green-400 text-xs">
                        R$ {entry.valor.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-0.5 justify-center">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1 rounded-md hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => openDelete(entry)}
                            className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} de {sorted.length}</span>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-6 w-16 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}/pág</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0} className="h-6 w-6 p-0">«</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="h-6 px-2 text-[10px]">
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="px-2 text-xs font-medium">{page + 1}/{totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-6 px-2 text-[10px]">
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="h-6 w-6 p-0">»</Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ADD DIALOG */}
      {/* ══════════════════════════════════════════ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" /> Adicionar Rota
            </DialogTitle>
            <DialogDescription>Defina a origem, destino e valor da nova rota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <AutocompleteInput label="Origem" value={formOrigem} onChange={setFormOrigem} placeholder="Ex: Centro do Cabo" />
            <AutocompleteInput label="Destino" value={formDestino} onChange={setFormDestino} placeholder="Ex: Boa Viagem" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={formValor} onChange={(e) => setFormValor(e.target.value)}
                  placeholder="49.99"
                />
              </div>
              <div>
                <Label className="text-xs">Região</Label>
                <Input value={formRegiao} onChange={(e) => setFormRegiao(e.target.value)} placeholder="Cabo" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAdd} className="gap-1.5">
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════ */}
      {/* EDIT DIALOG */}
      {/* ══════════════════════════════════════════ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" /> Editar Rota
            </DialogTitle>
            <DialogDescription>Altere os dados da rota selecionada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <AutocompleteInput label="Origem" value={formOrigem} onChange={setFormOrigem} />
            <AutocompleteInput label="Destino" value={formDestino} onChange={setFormDestino} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={formValor} onChange={(e) => setFormValor(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Região</Label>
                <Input value={formRegiao} onChange={(e) => setFormRegiao(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleEdit} className="gap-1.5">
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════ */}
      {/* DELETE SINGLE DIALOG */}
      {/* ══════════════════════════════════════════ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Excluir Rota
            </DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          {deletingEntry && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Origem:</span> <strong>{deletingEntry.origem}</strong></p>
              <p><span className="text-muted-foreground">Destino:</span> <strong>{deletingEntry.destino}</strong></p>
              <p><span className="text-muted-foreground">Valor:</span> <strong className="text-green-400">R$ {deletingEntry.valor.toFixed(2)}</strong></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-1.5">
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════ */}
      {/* BULK DELETE DIALOG */}
      {/* ══════════════════════════════════════════ */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Excluir {selected.size} Rota(s)
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir as {selected.size} rota(s) selecionada(s)? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} className="gap-1.5">
              <Trash2 className="w-4 h-4" /> Excluir {selected.size} rota(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════ */}
      {/* IMPORT DIALOG */}
      {/* ══════════════════════════════════════════ */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-accent" /> Importar Tabela
            </DialogTitle>
            <DialogDescription>
              Selecione um arquivo JSON com a tabela de preços.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <FileJson className="w-4 h-4" />
                {importFileName || 'Selecionar arquivo JSON'}
              </Button>
            </div>

            {importData && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium">{importData.length.toLocaleString('pt-BR')} rotas encontradas</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs">Modo de importação</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={importMode === 'merge' ? 'default' : 'outline'}
                      onClick={() => setImportMode('merge')}
                      className="flex-1 text-xs"
                    >
                      Mesclar (manter existentes)
                    </Button>
                    <Button
                      size="sm"
                      variant={importMode === 'replace' ? 'destructive' : 'outline'}
                      onClick={() => setImportMode('replace')}
                      className="flex-1 text-xs"
                    >
                      Substituir tudo
                    </Button>
                  </div>
                  {importMode === 'replace' && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Todas as rotas atuais serão removidas!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!importData} className="gap-1.5">
              <Upload className="w-4 h-4" /> Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════ */}
      {/* STATS DIALOG */}
      {/* ══════════════════════════════════════════ */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" /> Estatísticas da Tabela
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Total de Rotas</p>
                <p className="text-2xl font-bold">{stats.totalRotas.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Origens Únicas</p>
                <p className="text-2xl font-bold">{stats.totalOrigens}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Destinos Únicos</p>
                <p className="text-2xl font-bold">{stats.totalDestinos}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Faixa de Preço</p>
                <p className="text-sm font-bold text-green-400">R$ {stats.precoMin.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">até</p>
                <p className="text-sm font-bold text-green-400">R$ {stats.precoMax.toFixed(2)}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium mb-2">Rotas por Origem</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {origens.map(o => {
                  const count = tabela.filter(e => e.origem === o).length;
                  return (
                    <div key={o} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                      <span className="truncate mr-2">{o}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatsDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTabelaPrecos;
