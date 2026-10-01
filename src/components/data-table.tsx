'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { enUS, ptBR } from '@mui/x-data-grid/locales';
import {
  DataGrid,
  type GridColDef,
  type GridDensity,
  type GridPaginationModel,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridColumnVisibilityModel,
  type GridRowParams,
} from '@mui/x-data-grid';

import { EmptyState } from './empty-state';

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type Props<Row extends { id: string }> = {
  rows: Row[];
  columns: GridColDef<Row>[];
  rowCount: number;
  loading?: boolean;

  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;

  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;

  /** Controles de filtro exibidos à direita da busca (selects, toggles). */
  filters?: React.ReactNode;
  /** Chips removíveis representando os filtros ativos. */
  activeFilters?: FilterChip[];
  onClearFilters?: () => void;

  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  /** Barra de ações em massa; recebe os ids selecionados. */
  bulkActions?: (ids: string[]) => React.ReactNode;

  onRowClick?: (id: string) => void;

  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: string;
  emptyAction?: React.ReactNode;
  /** Vazio por filtro é diferente de vazio por não haver cadastro. */
  hasFiltersApplied?: boolean;

  height?: number;
};

const EMPTY_SELECTION: GridRowSelectionModel = { type: 'include', ids: new Set<string>() };

/**
 * O rodapé e os menus do DataGrid trazem textos próprios, que não passam pelo
 * next-intl — sem isto o usuário em pt vê "Rows per page" no meio da tela.
 */
const GRID_LOCALES = {
  pt: ptBR.components.MuiDataGrid.defaultProps.localeText,
  en: enUS.components.MuiDataGrid.defaultProps.localeText,
} as const;

export function DataTable<Row extends { id: string }>({
  rows,
  columns,
  rowCount,
  loading = false,
  search,
  onSearchChange,
  searchPlaceholder,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  filters,
  activeFilters = [],
  onClearFilters,
  selectedIds,
  onSelectedIdsChange,
  bulkActions,
  onRowClick,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  hasFiltersApplied = false,
  height = 560,
}: Props<Row>) {
  const t = useTranslations('Common');
  const locale = useLocale();

  const [density, setDensity] = useState<GridDensity>('standard');
  const [densityAnchor, setDensityAnchor] = useState<HTMLElement | null>(null);
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityModel>({});

  const selectionEnabled = Boolean(onSelectedIdsChange);

  const selectionModel = useMemo<GridRowSelectionModel>(
    () =>
      selectedIds
        ? { type: 'include', ids: new Set<string>(selectedIds) }
        : EMPTY_SELECTION,
    [selectedIds]
  );

  /**
   * O DataGrid representa "marcar tudo" como `exclude`, que num grid paginado
   * no servidor significaria todas as páginas — perigoso para uma ação em
   * massa. Aqui `exclude` é resolvido contra as linhas da página atual, então
   * o cabeçalho sempre seleciona apenas o que está à vista.
   */
  const handleSelectionChange = (model: GridRowSelectionModel) => {
    if (!onSelectedIdsChange) {
      return;
    }

    if (model.type === 'include') {
      onSelectedIdsChange(Array.from(model.ids, String));
      return;
    }

    onSelectedIdsChange(rows.map((row) => row.id).filter((id) => !model.ids.has(id)));
  };

  /**
   * O DataGrid limpa, durante o render, um sort que aponte para coluna
   * inexistente ou não ordenável — e avisa o pai, causando setState em tempo
   * de renderização. Filtrar antes mantém o aviso longe e a grade coerente.
   */
  const safeSortModel = useMemo(
    () =>
      sortModel.filter((item) =>
        columns.some((column) => column.field === item.field && column.sortable !== false)
      ),
    [sortModel, columns]
  );

  const noRowsOverlay = useMemo(
    () =>
      function NoRows() {
        return (
          <Stack sx={{ height: 1, justifyContent: 'center' }}>
            <EmptyState
              icon={hasFiltersApplied ? 'mdi:filter-remove-outline' : emptyIcon}
              title={hasFiltersApplied ? t('noResults') : emptyTitle}
              description={hasFiltersApplied ? t('noResultsDescription') : emptyDescription}
              action={hasFiltersApplied ? undefined : emptyAction}
              size="compact"
            />
          </Stack>
        );
      },
    [hasFiltersApplied, emptyIcon, emptyTitle, emptyDescription, emptyAction, t]
  );

  const hideableColumns = columns.filter((column) => column.hideable !== false);
  const selectionCount = selectedIds?.length ?? 0;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <TextField
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder ?? t('search')}
            size="small"
            sx={{ flex: 1, minWidth: 220 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:magnify" width={20} height={20} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => onSearchChange('')} aria-label={t('clear')}>
                      <Icon icon="mdi:close" width={16} height={16} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />

          {filters}

          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t('columns')}>
              <IconButton onClick={(event) => setColumnsAnchor(event.currentTarget)} size="small">
                <Icon icon="mdi:view-column-outline" width={20} height={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('density')}>
              <IconButton onClick={(event) => setDensityAnchor(event.currentTarget)} size="small">
                <Icon icon="mdi:format-line-spacing" width={20} height={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {activeFilters.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {activeFilters.map((filter) => (
              <Chip
                key={filter.key}
                label={filter.label}
                size="small"
                onDelete={filter.onRemove}
                variant="outlined"
              />
            ))}
            {onClearFilters && activeFilters.length > 1 && (
              <Typography
                variant="caption"
                onClick={onClearFilters}
                sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600 }}
              >
                {t('clearFilters')}
              </Typography>
            )}
          </Stack>
        )}
      </Stack>

      {selectionEnabled && selectionCount > 0 && bulkActions && (
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Checkbox
              checked
              indeterminate={selectionCount < rows.length}
              onChange={() => onSelectedIdsChange?.([])}
              size="small"
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {t('selected', { count: selectionCount })}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            {bulkActions(selectedIds ?? [])}
          </Stack>
        </Stack>
      )}

      <Divider />

      <Box sx={{ height, width: 1 }}>
        <DataGrid<Row>
          rows={rows}
          columns={columns}
          rowCount={rowCount}
          loading={loading}
          density={density}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          sortingMode="server"
          sortModel={safeSortModel}
          onSortModelChange={onSortModelChange}
          checkboxSelection={selectionEnabled}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={handleSelectionChange}
          columnVisibilityModel={columnVisibility}
          onColumnVisibilityModelChange={setColumnVisibility}
          localeText={GRID_LOCALES[locale === 'pt' ? 'pt' : 'en']}
          disableRowSelectionOnClick
          disableColumnFilter
          onRowClick={onRowClick ? (params: GridRowParams<Row>) => onRowClick(String(params.id)) : undefined}
          slots={{ noRowsOverlay }}
          slotProps={{
            loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' },
          }}
          sx={{
            border: 0,
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default' },
            '& .MuiDataGrid-row': { cursor: onRowClick ? 'pointer' : 'default' },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
          }}
        />
      </Box>

      <Menu anchorEl={densityAnchor} open={Boolean(densityAnchor)} onClose={() => setDensityAnchor(null)}>
        {(['compact', 'standard', 'comfortable'] as const).map((option) => (
          <MenuItem
            key={option}
            selected={density === option}
            onClick={() => {
              setDensity(option);
              setDensityAnchor(null);
            }}
          >
            <ListItemText>{t(`densityOptions.${option}`)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={columnsAnchor} open={Boolean(columnsAnchor)} onClose={() => setColumnsAnchor(null)}>
        {hideableColumns.map((column) => {
          const visible = columnVisibility[column.field] !== false;

          return (
            <MenuItem
              key={column.field}
              onClick={() =>
                setColumnVisibility((current) => ({ ...current, [column.field]: !visible }))
              }
            >
              <ListItemIcon>
                <Icon
                  icon={visible ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'}
                  width={20}
                  height={20}
                />
              </ListItemIcon>
              <ListItemText>{column.headerName ?? column.field}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </Paper>
  );
}
