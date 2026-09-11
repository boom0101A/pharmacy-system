interface SkeletonProps {
    width?: string;
    height?: string;
    radius?: string;
}
export declare function Skeleton({ width, height, radius }: SkeletonProps): import("react").JSX.Element;
/** A placeholder table body — same row/column shape as the real table so the layout doesn't jump once data arrives. */
export declare function SkeletonRows({ rows, columns }: {
    rows: number;
    columns: number;
}): import("react").JSX.Element;
export {};
