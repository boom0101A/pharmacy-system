import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
}

export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-sm)' }: SkeletonProps) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} />;
}

/** A placeholder table body — same row/column shape as the real table so the layout doesn't jump once data arrives. */
export function SkeletonRows({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }, (_, c) => (
            <td key={c}>
              <Skeleton height="1.25rem" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
