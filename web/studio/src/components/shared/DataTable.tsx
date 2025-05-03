import React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T;
  /** Optional custom cell renderer */
  cell?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}

function DataTable<T extends object>({ columns, data, onRowClick }: DataTableProps<T>) {
  return (
    <table className="min-w-full table-auto border-collapse">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={String(col.accessor)} className="px-4 py-2 border-b text-left">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr
            key={idx}
            onClick={() => onRowClick && onRowClick(row)}
            className={onRowClick ? 'cursor-pointer hover:bg-gray-100' : ''}
          >
            {columns.map((col) => (
              <td key={String(col.accessor)} className="px-4 py-2 border-b">
                {col.cell ? col.cell(row) : String(row[col.accessor])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;
