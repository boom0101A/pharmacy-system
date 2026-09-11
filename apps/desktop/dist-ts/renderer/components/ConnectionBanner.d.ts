interface Props {
    onRetry: () => void;
}
/** A dead server is worth saying even on the login screen — it's usually the real reason "the password isn't working". */
export declare function ConnectionBanner({ onRetry }: Props): import("react").JSX.Element | null;
export {};
