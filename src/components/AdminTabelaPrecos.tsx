import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Search, Plus, Pencil, Trash2, Save, Download, Upload,
  ChevronLeft, ChevronRight, Loader2, TableProperties,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X, FileJson, Copy,
  BarChart3, MapPin, Route, DollarSign, AlertTriangle, CheckCircle, Layers,
  Replace,
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

type RegiaoItem = {
  id: string;
  codigo: number;
  nome: string;
  ativo: boolean;
};

type SortKey = 'origem' | 'destino' | 'valor' | 'regiao';
type SortDir = 'asc' | 'desc';

type AutocompleteInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  allLocations: string[];
};

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  placeholder,
  label,
  allLocations,
}) => {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    const q = normalizeText(value);
    return allLocations.filter((l) => normalizeText(l).includes(q)).slice(0, 8);
  }, [value, allLocations]);

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
          {suggestions.map((s) => (
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

const AdminTabelaPrecos: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mainTab, setMainTab] = useState<'rotas' | 'regioes'>('regioes');
  const [newRegiao, setNewRegiao] = useState('');
  const [editingRegiaoId, setEditingRegiaoId] = useState<string | null>(null);
  const [editRegiaoNome, setEditRegiaoNome] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [localFilterRegiao, setLocalFilterRegiao] = useState<string>('_all');
  const [localFilterTipo, setLocalFilterTipo] = useState<'_all' | 'origem' | 'destino' | 'ambos'>('_all');
  const [selectedLocais, setSelectedLocais] = useState<Set<string>>(new Set());
  const [targetRegiao, setTargetRegiao] = useState<string>('');

  // ── Data from Supabase ──
  const { data: tabela = [], isLoading: loadingTabela } = useQuery({
    queryKey: ['tabela-precos'],
    queryFn: fetchTabelaFromSupabase,
  });

  const { data: regioes = [], isLoading: loadingRegioes } = useQuery({
    queryKey: ['regioes-precos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('regioes_precos')
        .select('id, codigo, nome, ativo')
        .eq('ativo', true)
        .order('codigo', { ascending: true });
      if (error) throw error;
      return (data || []) as RegiaoItem[];
    },
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
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);
  const [bulkUpdateOldValue, setBulkUpdateOldValue] = useState('');
  const [bulkUpdateNewValue, setBulkUpdateNewValue] = useState('');

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
  const regioesTabela = useMemo(() => [...new Set(tabela.map(e => e.regiao))].sort(), [tabela]);
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

  const locaisUnificados = useMemo(() => {
    const map = new Map<string, { local: string; origemCount: number; destinoCount: number; total: number; regiaoAtual: string }>();

    for (const row of tabela) {
      if (!map.has(row.origem)) {
        map.set(row.origem, { local: row.origem, origemCount: 0, destinoCount: 0, total: 0, regiaoAtual: row.regiao || '' });
      }
      if (!map.has(row.destino)) {
        map.set(row.destino, { local: row.destino, origemCount: 0, destinoCount: 0, total: 0, regiaoAtual: row.regiao || '' });
      }

      const origemItem = map.get(row.origem)!;
      origemItem.origemCount += 1;
      origemItem.total += 1;
      if (!origemItem.regiaoAtual && row.regiao) origemItem.regiaoAtual = row.regiao;

      const destinoItem = map.get(row.destino)!;
      destinoItem.destinoCount += 1;
      destinoItem.total += 1;
      if (!destinoItem.regiaoAtual && row.regiao) destinoItem.regiaoAtual = row.regiao;
    }

    const arr = Array.from(map.values()).sort((a, b) => a.local.localeCompare(b.local, 'pt-BR'));

    return arr.filter(x => {
      if (localFilterRegiao === '_sem' && x.regiaoAtual) return false;
      if (localFilterRegiao !== '_all' && localFilterRegiao !== '_sem' && x.regiaoAtual !== localFilterRegiao) return false;

      const ehOrigem = x.origemCount > 0;
      const ehDestino = x.destinoCount > 0;
      if (localFilterTipo === 'origem' && !ehOrigem) return false;
      if (localFilterTipo === 'destino' && !ehDestino) return false;
      if (localFilterTipo === 'ambos' && !(ehOrigem && ehDestino)) return false;

      if (localSearch.trim()) {
        const q = normalizeText(localSearch);
        if (!normalizeText(x.local).includes(q)) return false;
      }

      return true;
    });
  }, [tabela, localSearch, localFilterRegiao, localFilterTipo]);

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

  const bulkUpdateValueMutation = useMutation({
    mutationFn: async ({ oldValue, newValue }: { oldValue: number; newValue: number }) => {
      const matching = tabela.filter(e => e.valor === oldValue);
      if (matching.length === 0) throw new Error('Nenhuma rota encontrada com esse valor.');
      const ids = matching.map(e => e.id).filter((id): id is string => !!id);
      if (ids.length === 0) throw new Error('Rotas sem ID.');
      const { error } = await (supabase as any)
        .from('tabela_precos')
        .update({ valor: newValue })
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      onMutationSuccess(`${count} rota(s) atualizada(s) com novo valor!`);
      setShowBulkUpdateDialog(false);
      setBulkUpdateOldValue('');
      setBulkUpdateNewValue('');
    },
    onError: (e: any) => toast({ title: 'Erro ao atualizar em lote', description: e?.message, variant: 'destructive' }),
  });

  // ── Distinct values for bulk update ──
  const distinctValues = useMemo(() => {
    const valMap = new Map<number, number>();
    tabela.forEach(e => valMap.set(e.valor, (valMap.get(e.valor) || 0) + 1));
    return Array.from(valMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([valor, count]) => ({ valor, count }));
  }, [tabela]);

  const bulkMatchCount = useMemo(() => {
    const v = parseFloat(bulkUpdateOldValue);
    if (isNaN(v)) return 0;
    return tabela.filter(e => e.valor === v).length;
  }, [tabela, bulkUpdateOldValue]);

  const createRegiaoMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await (supabase as any)
        .from('regioes_precos')
        .insert({ nome: nome.trim(), ativo: true });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regioes-precos'] });
      toast({ title: 'Região criada com sucesso!' });
      setNewRegiao('');
    },
    onError: (e: any) => toast({ title: 'Erro ao criar região', description: e?.message, variant: 'destructive' }),
  });

  const deleteRegiaoMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await (supabase as any)
        .from('regioes_precos')
        .delete()
        .eq('nome', nome);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regioes-precos'] });
      toast({ title: 'Região removida!' });
    },
    onError: (e: any) => toast({ title: 'Erro ao remover região', description: e?.message, variant: 'destructive' }),
  });

  const updateRegiaoMutation = useMutation({
    mutationFn: async ({ id, nomeAnterior, nomeNovo }: { id: string; nomeAnterior: string; nomeNovo: string }) => {
      const { error: regiaoError } = await (supabase as any)
        .from('regioes_precos')
        .update({ nome: nomeNovo.trim() })
        .eq('id', id);
      if (regiaoError) throw regiaoError;

      if (nomeAnterior !== nomeNovo.trim()) {
        const { error: rotasError } = await (supabase as any)
          .from('tabela_precos')
          .update({ regiao: nomeNovo.trim() })
          .eq('regiao', nomeAnterior);
        if (rotasError) throw rotasError;
      }
    },
    onSuccess: async () => {
      setEditingRegiaoId(null);
      setEditRegiaoNome('');
      await syncCacheFromSupabase();
      qc.invalidateQueries({ queryKey: ['regioes-precos'] });
      qc.invalidateQueries({ queryKey: ['tabela-precos'] });
      toast({ title: 'Região atualizada com sucesso!' });
    },
    onError: (e: any) => toast({ title: 'Erro ao editar região', description: e?.message, variant: 'destructive' }),
  });

  const assignRegiaoMutation = useMutation({
    mutationFn: async ({ locais, regiao }: { locais: string[]; regiao: string }) => {
      const localSet = new Set(locais);
      const ids = tabela
        .filter(r => localSet.has(r.origem) || localSet.has(r.destino))
        .map(r => r.id)
        .filter((id): id is string => !!id);

      if (ids.length === 0) {
        throw new Error('Nenhuma rota encontrada para os locais selecionados.');
      }

      const updates = ids.map(id => updateEntrySupabase(id, { regiao }));
      await Promise.all(updates);
    },
    onSuccess: async () => {
      await onMutationSuccess('Região atualizada para os locais selecionados!');
      qc.invalidateQueries({ queryKey: ['regioes-precos'] });
      setSelectedLocais(new Set());
    },
    onError: (e: any) => toast({ title: 'Erro ao atribuir região', description: e?.message, variant: 'destructive' }),
  });

  useEffect(() => {
    const firstSelected = Array.from(selectedLocais)[0];
    if (!firstSelected) return;
    const localInfo = locaisUnificados.find(l => l.local === firstSelected);
    if (localInfo?.regiaoAtual) {
      setTargetRegiao(localInfo.regiaoAtual);
      return;
    }
    if (regioes[0]?.nome) {
      setTargetRegiao(regioes[0].nome);
    }
  }, [selectedLocais, locaisUnificados, regioes]);

  const handleCreateRegiao = () => {
    if (!newRegiao.trim()) {
      toast({ title: 'Informe o nome da região', variant: 'destructive' });
      return;
    }
    createRegiaoMutation.mutate(newRegiao);
  };

  const handleDeleteRegiao = (nome: string) => {
    const emUso = tabela.some(r => r.regiao === nome);
    if (emUso) {
      toast({ title: 'Região em uso', description: 'Reatribua os locais antes de remover esta região.', variant: 'destructive' });
      return;
    }
    deleteRegiaoMutation.mutate(nome);
  };

  const openEditRegiao = (regiao: RegiaoItem) => {
    setEditingRegiaoId(regiao.id);
    setEditRegiaoNome(regiao.nome);
  };

  const cancelEditRegiao = () => {
    setEditingRegiaoId(null);
    setEditRegiaoNome('');
  };

  const handleSaveRegiao = (regiao: RegiaoItem) => {
    const nomeNovo = editRegiaoNome.trim();

    if (!nomeNovo) {
      toast({ title: 'Informe o nome da região', variant: 'destructive' });
      return;
    }

    updateRegiaoMutation.mutate({
      id: regiao.id,
      nomeAnterior: regiao.nome,
      nomeNovo,
    });
  };

  const handleAssignRegiao = () => {
    if (selectedLocais.size === 0) {
      toast({ title: 'Selecione ao menos um local', variant: 'destructive' });
      return;
    }
    if (!targetRegiao) {
      toast({ title: 'Selecione a região de destino', variant: 'destructive' });
      return;
    }
    assignRegiaoMutation.mutate({ locais: Array.from(selectedLocais), regiao: targetRegiao });
  };

  const toggleLocalSelection = (local: string) => {
    setSelectedLocais(prev => {
      const next = new Set(prev);
      if (next.has(local)) next.delete(local);
      else next.add(local);
      return next;
    });
  };

  const selectAllFilteredLocais = () => {
    setSelectedLocais(new Set(locaisUnificados.map(l => l.local)));
  };

  const clearSelectedLocais = () => {
    setSelectedLocais(new Set());
  };

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
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'rotas' | 'regioes')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="regioes" className="gap-1 text-xs">
            <Layers className="w-3.5 h-3.5" /> Regiões
          </TabsTrigger>
          <TabsTrigger value="rotas" className="gap-1 text-xs">
            <Route className="w-3.5 h-3.5" /> Rotas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rotas" className="space-y-3 mt-3">
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
          <Button size="sm" variant="outline" onClick={() => { setBulkUpdateOldValue(''); setBulkUpdateNewValue(''); setShowBulkUpdateDialog(true); }} className="gap-1.5 h-8">
            <Replace className="w-3.5 h-3.5" /> Alterar Valores
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

        </TabsContent>

        <TabsContent value="regioes" className="space-y-3 mt-3">

          {/* ── Seção 1: Criar + Listar Regiões ── */}
          <Card>
            <CardContent className="py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Regiões</p>
                <Badge variant="outline" className="text-xs">{regioes.length} cadastrada(s)</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newRegiao}
                  onChange={(e) => setNewRegiao(e.target.value)}
                  placeholder="Nome da nova região..."
                  className="h-8 text-xs flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRegiao()}
                />
                <Button
                  onClick={handleCreateRegiao}
                  disabled={createRegiaoMutation.isPending}
                  size="sm"
                  className="h-8 text-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Criar
                </Button>
              </div>
              {(regioes.length === 0 && !loadingRegioes) ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma região cadastrada.</p>
              ) : (
                <div className="grid gap-1.5">
                  {regioes.map((r) => {
                    const uso = tabela.filter(t => t.regiao === r.nome).length;
                    const isEditing = editingRegiaoId === r.id;
                    return (
                      <div key={r.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground bg-background/60 font-mono shrink-0">
                          {r.codigo}
                        </span>
                        {isEditing ? (
                          <Input
                            value={editRegiaoNome}
                            onChange={(e) => setEditRegiaoNome(e.target.value)}
                            className="h-7 text-xs flex-1"
                            placeholder="Nome da região"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRegiao(r)}
                          />
                        ) : (
                          <span className="text-xs font-medium flex-1 truncate">{r.nome}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] shrink-0">{uso} rota(s)</Badge>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isEditing ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleSaveRegiao(r)} disabled={updateRegiaoMutation.isPending} className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-300">
                                <Save className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditRegiao} disabled={updateRegiaoMutation.isPending} className="h-6 w-6 p-0 text-muted-foreground">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEditRegiao(r)} disabled={deleteRegiaoMutation.isPending} className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteRegiao(r.nome)} disabled={deleteRegiaoMutation.isPending} className="h-6 w-6 p-0 text-red-400 hover:text-red-300">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Seção 2: Atribuir regiões a locais ── */}
          <Card>
            <CardContent className="py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Locais e Atribuição</p>
                  <p className="text-[11px] text-muted-foreground">Selecione locais e atribua a uma região.</p>
                </div>
                <Badge variant="outline" className="text-xs">{locaisUnificados.length} locais</Badge>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Buscar local..."
                  className="h-8 text-xs"
                />
                <Select value={localFilterRegiao} onValueChange={setLocalFilterRegiao}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar região" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas regiões</SelectItem>
                    <SelectItem value="_sem">Sem região</SelectItem>
                    {regioes.map((r) => (
                      <SelectItem key={r.id} value={r.nome}>{r.codigo} - {r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={localFilterTipo} onValueChange={(v) => setLocalFilterTipo(v as '_all' | 'origem' | 'destino' | 'ambos')}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos tipos</SelectItem>
                    <SelectItem value="origem">Só origem</SelectItem>
                    <SelectItem value="destino">Só destino</SelectItem>
                    <SelectItem value="ambos">Origem e destino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Barra de ações em lote */}
              <div className="flex items-center gap-2 flex-wrap bg-muted/20 rounded-lg px-2.5 py-2">
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectAllFilteredLocais}>
                  Selecionar todos
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={clearSelectedLocais} disabled={selectedLocais.size === 0}>
                  Limpar
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Badge variant="secondary" className="text-[10px]">{selectedLocais.size} selecionado(s)</Badge>
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={targetRegiao} onValueChange={setTargetRegiao}>
                    <SelectTrigger className="h-7 text-[11px] w-40"><SelectValue placeholder="Região destino" /></SelectTrigger>
                    <SelectContent>
                      {regioes.map((r) => (
                        <SelectItem key={r.id} value={r.nome}>{r.codigo} - {r.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssignRegiao} disabled={assignRegiaoMutation.isPending || selectedLocais.size === 0} size="sm" className="h-7 text-[11px]">
                    Aplicar
                  </Button>
                </div>
              </div>

              {/* Lista de locais */}
              <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                {locaisUnificados.map((l) => (
                  <div
                    key={l.local}
                    onClick={() => toggleLocalSelection(l.local)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                      selectedLocais.has(l.local) ? 'bg-accent/10 border border-accent/30' : 'hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={selectedLocais.has(l.local)}
                      onCheckedChange={() => toggleLocalSelection(l.local)}
                      className="shrink-0"
                    />
                    <span className="text-xs font-medium flex-1 truncate">{l.local}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{l.origemCount}O • {l.destinoCount}D</span>
                    <Badge variant={l.regiaoAtual ? 'outline' : 'secondary'} className={`text-[10px] shrink-0 ${l.regiaoAtual ? '' : 'text-muted-foreground'}`}>
                      {l.regiaoAtual || 'Sem região'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            <AutocompleteInput label="Origem" value={formOrigem} onChange={setFormOrigem} placeholder="Ex: Centro do Cabo" allLocations={allLocations} />
            <AutocompleteInput label="Destino" value={formDestino} onChange={setFormDestino} placeholder="Ex: Boa Viagem" allLocations={allLocations} />
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
            <AutocompleteInput label="Origem" value={formOrigem} onChange={setFormOrigem} allLocations={allLocations} />
            <AutocompleteInput label="Destino" value={formDestino} onChange={setFormDestino} allLocations={allLocations} />
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

      {/* ── Bulk Update Values Dialog ── */}
      <Dialog open={showBulkUpdateDialog} onOpenChange={setShowBulkUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Replace className="w-5 h-5 text-accent" />
              Alterar Valores em Lote
            </DialogTitle>
            <DialogDescription>
              Selecione um valor existente e defina o novo valor. Todas as rotas com o valor selecionado serão atualizadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor atual</Label>
              <Select value={bulkUpdateOldValue} onValueChange={setBulkUpdateOldValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um valor..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {distinctValues.map(({ valor, count }) => (
                    <SelectItem key={valor} value={valor.toString()}>
                      R$ {valor.toFixed(2)} ({count} rota{count > 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bulkMatchCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {bulkMatchCount} rota(s) serão atualizadas
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Novo valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={bulkUpdateNewValue}
                onChange={e => setBulkUpdateNewValue(e.target.value)}
                placeholder="Ex: 25.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkUpdateDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const oldV = parseFloat(bulkUpdateOldValue);
                const newV = parseFloat(bulkUpdateNewValue);
                if (isNaN(oldV) || isNaN(newV) || newV < 0) {
                  toast({ title: 'Valores inválidos', variant: 'destructive' });
                  return;
                }
                bulkUpdateValueMutation.mutate({ oldValue: oldV, newValue: newV });
              }}
              disabled={!bulkUpdateOldValue || !bulkUpdateNewValue || bulkUpdateValueMutation.isPending}
              className="gap-1.5"
            >
              {bulkUpdateValueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Atualizar {bulkMatchCount > 0 ? `${bulkMatchCount} rota(s)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTabelaPrecos;
