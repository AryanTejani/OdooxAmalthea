import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from './EmptyState';
import { SkeletonRow } from './SkeletonRow';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableLiteProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKey?: (item: T) => string;
  isLoading?: boolean;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  pageSize?: number;
  className?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
}

export function DataTableLite<T extends Record<string, any>>({
  data,
  columns,
  searchKey,
  isLoading = false,
  emptyState,
  pageSize = 10,
  className,
  searchPlaceholder = 'Search...',
  onRowClick,
}: DataTableLiteProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(pageSize);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search || !searchKey) return data;
    const searchLower = search.toLowerCase();
    return data.filter((item) => searchKey(item).toLowerCase().includes(searchLower));
  }, [data, search, searchKey]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSizeState;
    const end = start + pageSizeState;
    return filteredData.slice(start, end);
  }, [filteredData, currentPage, pageSizeState]);

  const totalPages = Math.ceil(filteredData.length / pageSizeState);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {searchKey && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search"
            />
          </div>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: pageSizeState }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (filteredData.length === 0 && !isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {searchKey && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search"
            />
          </div>
        )}
        {emptyState ? (
          <EmptyState {...emptyState} />
        ) : (
          <EmptyState
            title="No data found"
            subtitle={search ? 'Try adjusting your search terms' : 'No items to display'}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search */}
      {searchKey && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow 
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              >
                {columns.map((col) => (
                  <TableCell key={col.key}>{col.cell(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSizeState.toString()}
              onValueChange={(value) => {
                setPageSizeState(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

