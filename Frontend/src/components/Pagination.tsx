import { useEffect, useState } from 'react';

export const PAGE_SIZE = 6;
export function usePagination<T>(records: T[], criteria: string, pageSize = PAGE_SIZE) {
  const [position, setPosition] = useState({ criteria, page: 1 });
  const pages = Math.max(1, Math.ceil(records.length / pageSize));
  const page = position.criteria === criteria ? Math.min(position.page, pages) : 1;
  useEffect(() => {
    if (position.criteria !== criteria || position.page !== page) setPosition({ criteria, page });
  }, [criteria, page, position]);
  return { page, pages, pageSize, total: records.length, setPage: (next: number) => setPosition({ criteria, page: Math.max(1, Math.min(next, pages)) }), records: records.slice((page - 1) * pageSize, page * pageSize) };
}
export default function Pagination({ label, page, pages, total, setPage, pageSize = PAGE_SIZE }: { label: string; page: number; pages: number; total: number; pageSize?: number; setPage: (page: number) => void }) {
  return <nav className="table-pagination" aria-label={`${label} pagination`}><span role="status">{label} · {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total} records · Page {page} of {pages}</span><div><button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className="secondary" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></nav>;
}
