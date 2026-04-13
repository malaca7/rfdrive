import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import {
  getTabela, getOrigens, getTabelaStats, getTabelaVersion,
  addEntry, updateEntry, deleteEntry, deleteBulk,
  importTabela, exportTabela,
  type TabelaEntry,
} from '@/lib/tabela-preco';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

type SortKey = 'origem' | 'destino' | 'valor' | 'regiao';
type SortDir = 'asc' | 'desc';

const AdminTabelaPrecos: React.FC = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Force re-render when table mutates
  const [, setRenderKey] = useState(0);
  const rerender = useCallback(() => setRenderKey(k => k + 1), []);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState<string>('_all');
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
  const [deletingEntry, setDeletingEntry] = useState<TabelaEntry | null>(null);

  // ── Import state ──
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importData, setImportData] = useState<TabelaEntry[] | null>(null);
  const [importFileName, setImportFileName] = useState('');

  // ── Data ──
  const tabela = getTabela();
  const origens = useMemo(() => getOrigens(), [getTabelaVersion()]);
  const regioes = useMemo(() => [...new Set(tabela.map(e => e.regiao))].sort(), [getTabelaVersion()]);
  const stats = useMemo(() => getTabelaStats(), [getTabelaVersion()]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let data = tabela;
    if (filterOrigem !== '_all') {
      data = data.filter(e => e.origem === filterOrigem);
    }
    if (filterRegiao !== '_all') {
      data = data.filter(e => e.regiao === filterRegiao);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(e =>
        e.origem.toLowerCase().includes(q) ||
        e.destino.toLowerCase().includes(q) ||
        e.valor.toString().includes(q)
      );
    }
    return data;
  }, [tabela, filterOrigem, filterRegiao, search, getTabelaVersion()]);

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

  const entryKey = (e: TabelaEntry) => `${e.origem}||${e.destino}`;

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

  // ── Add entry ──
  const handleAdd = () => {
    const valor = parseFloat(formValor.replace(',', '.'));
    if (!formOrigem.trim() || !formDestino.trim() || isNaN(valor) || valor <= 0) {
      toast({ title: 'Preencha todos os campos corretamente', variant: 'destructive' });
      return;
    }
    const ok = addEntry({ origem: formOrigem.trim(), destino: formDestino.trim(), valor, regiao: formRegiao.trim() || 'Cabo' });
    if (!ok) {
      toast({ title: 'Rota já existe', description: 'Essa combinação origem→destino já está na tabela.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Rota adicionada!' });
    setShowAddDialog(false);
    resetForm();
    rerender();
  };

  // ── Edit entry ──
  const openEdit = (e: TabelaEntry) => {
    setEditingEntry(e);
    setFormOrigem(e.origem);
    setFormDestino(e.destino);
    setFormValor(e.valor.toFixed(2));
    setFormRegiao(e.regiao);
    setShowEditDialog(true);
  };

  const handleEdit = () => {
    if (!editingEntry) return;
    const valor = parseFloat(formValor.replace(',', '.'));
    if (!formOrigem.trim() || !formDestino.trim() || isNaN(valor) || valor <= 0) {
      toast({ title: 'Preencha todos os campos corretamente', variant: 'destructive' });
      return;
    }
    const ok = updateEntry(editingEntry.origem, editingEntry.destino, {
      origem: formOrigem.trim(),
      destino: formDestino.trim(),
      valor,
      regiao: formRegiao.trim() || 'Cabo',
    });
    if (!ok) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      return;
    }
    toast({ title: 'Rota atualizada!' });
    setShowEditDialog(false);
    resetForm();
    rerender();
  };

  // ── Delete single ──
  const openDelete = (e: TabelaEntry) => { setDeletingEntry(e); setShowDeleteDialog(true); };

  const handleDelete = () => {
    if (!deletingEntry) return;
    deleteEntry(deletingEntry.origem, deletingEntry.destino);
    toast({ title: 'Rota removida' });
    setShowDeleteDialog(false);
    setDeletingEntry(null);
    selected.delete(entryKey(deletingEntry));
    rerender();
  };

  // ── Bulk delete ──
  const handleBulkDelete = () => {
    const entries = [...selected].map(k => {
      const [origem, destino] = k.split('||');
      return { origem, destino };
    });
    const removed = deleteBulk(entries);
    toast({ title: `${removed} rota(s) removida(s)` });
    setSelected(new Set());
    setShowBulkDeleteDialog(false);
    rerender();
  };

  // ── Export ──
  const handleExport = () => {
    const json = exportTabela();
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
    const result = importTabela(importData, importMode === 'replace');
    toast({ title: `Importação concluída`, description: `${result.added} adicionadas, ${result.skipped} ignoradas` });
    setShowImportDialog(false);
    setImportData(null);
    setImportFileName('');
    setPage(0);
    rerender();
  };

  const resetForm = () => {
    setFormOrigem('');
    setFormDestino('');
    setFormValor('');
    setFormRegiao('Cabo');
    setEditingEntry(null);
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-accent/30 transition-colors" onClick={() => setShowStatsDialog(true)}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Route className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Rotas</p>
              <p className="text-lg font-bold">{stats.totalRotas.toLocaleString('pt-BR')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Origens</p>
              <p className="text-lg font-bold">{stats.totalOrigens}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Destinos</p>
              <p className="text-lg font-bold">{stats.totalDestinos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Faixa</p>
              <p className="text-sm font-bold">R$ {stats.precoMin.toFixed(0)}–{stats.precoMax.toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar origem, destino ou valor..."
            className="pl-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={filterOrigem} onValueChange={(v) => { setFilterOrigem(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas as origens</SelectItem>
            {origens.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {regioes.length > 1 && (
          <Select value={filterRegiao} onValueChange={(v) => { setFilterRegiao(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas regiões</SelectItem>
              {regioes.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Adicionar Rota
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
          <Download className="w-4 h-4" /> Exportar
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setImportData(null); setImportFileName(''); setShowImportDialog(true); }} className="gap-1.5">
          <Upload className="w-4 h-4" /> Importar
        </Button>
        {selected.size > 0 && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Badge variant="secondary" className="text-xs">
              {selected.size} selecionada(s)
            </Badge>
            <Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteDialog(true)} className="gap-1.5">
              <Trash2 className="w-4 h-4" /> Remover Selecionadas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="gap-1.5 text-xs">
              <X className="w-3 h-3" /> Limpar seleção
            </Button>
          </>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length.toLocaleString('pt-BR')} rota(s) encontrada(s)
        </div>
      </div>

      {/* ── Table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2.5 px-3 w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="py-2.5 px-3 text-left font-medium cursor-pointer hover:text-accent transition-colors"
                  onClick={() => toggleSort('origem')}
                >
                  <span className="flex items-center gap-1.5">Origem <SortIcon col="origem" /></span>
                </th>
                <th
                  className="py-2.5 px-3 text-left font-medium cursor-pointer hover:text-accent transition-colors"
                  onClick={() => toggleSort('destino')}
                >
                  <span className="flex items-center gap-1.5">Destino <SortIcon col="destino" /></span>
                </th>
                <th
                  className="py-2.5 px-3 text-right font-medium cursor-pointer hover:text-accent transition-colors w-28"
                  onClick={() => toggleSort('valor')}
                >
                  <span className="flex items-center gap-1.5 justify-end">Valor <SortIcon col="valor" /></span>
                </th>
                <th
                  className="py-2.5 px-3 text-left font-medium cursor-pointer hover:text-accent transition-colors w-24"
                  onClick={() => toggleSort('regiao')}
                >
                  <span className="flex items-center gap-1.5">Região <SortIcon col="regiao" /></span>
                </th>
                <th className="py-2.5 px-3 w-20 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    {search || filterOrigem !== '_all' ? 'Nenhuma rota encontrada para os filtros aplicados.' : 'Tabela vazia.'}
                  </td>
                </tr>
              ) : (
                pageData.map((entry, i) => {
                  const k = entryKey(entry);
                  const isSelected = selected.has(k);
                  return (
                    <tr
                      key={k}
                      className={`border-b border-border/50 transition-colors ${isSelected ? 'bg-accent/5' : 'hover:bg-muted/30'}`}
                    >
                      <td className="py-2 px-3">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(entry)} />
                      </td>
                      <td className="py-2 px-3 font-medium">{entry.origem}</td>
                      <td className="py-2 px-3">{entry.destino}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-green-400">
                        R$ {entry.valor.toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px]">{entry.regiao}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1.5 rounded-md hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openDelete(entry)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Exibindo {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} de {sorted.length.toLocaleString('pt-BR')}</span>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-20 text-xs">
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
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="h-7 w-7 p-0"
            >
              «
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-7 px-2 gap-1"
            >
              <ChevronLeft className="w-3 h-3" /> Anterior
            </Button>
            <span className="px-3 text-xs font-medium">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-7 px-2 gap-1"
            >
              Próxima <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="h-7 w-7 p-0"
            >
              »
            </Button>
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
            <div>
              <Label className="text-xs">Origem</Label>
              <Input value={formOrigem} onChange={(e) => setFormOrigem(e.target.value)} placeholder="Ex: Centro do Cabo" />
            </div>
            <div>
              <Label className="text-xs">Destino</Label>
              <Input value={formDestino} onChange={(e) => setFormDestino(e.target.value)} placeholder="Ex: Boa Viagem" />
            </div>
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
            <div>
              <Label className="text-xs">Origem</Label>
              <Input value={formOrigem} onChange={(e) => setFormOrigem(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Destino</Label>
              <Input value={formDestino} onChange={(e) => setFormDestino(e.target.value)} />
            </div>
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
