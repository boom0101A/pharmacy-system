import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Cross } from 'lucide-react';
import styles from './Login.module.css';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../store/auth';
import { useBranding } from '../store/branding';
import { getServerUrl, setServerUrl } from '../lib/api';
export function Login() {
    const { login, loading, error } = useAuth();
    const logoUrl = useBranding((s) => s.logoUrl);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [server, setServer] = useState(getServerUrl());
    const [showServerField, setShowServerField] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        // The address is saved before the attempt so a retry uses the new value.
        setServerUrl(server);
        await login(username, password);
    }
    return (_jsx("div", { className: styles.page, children: _jsxs("div", { className: styles.card, children: [_jsxs("div", { className: styles.brand, children: [logoUrl ? (_jsx("img", { src: logoUrl, alt: "", className: styles.logo })) : (_jsx("span", { className: styles.mark, children: _jsx(Cross, { size: 26 }) })), _jsxs("div", { children: [_jsx("h1", { className: styles.title, children: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629" }), _jsx("p", { className: styles.subtitle, children: "\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629" })] })] }), _jsxs("form", { className: styles.form, onSubmit: handleSubmit, children: [error && _jsx("div", { className: styles.alert, children: error }), _jsx(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", value: username, onChange: (e) => setUsername(e.target.value), autoFocus: true, autoComplete: "username", required: true }), _jsx(Input, { label: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password", required: true }), _jsx(Button, { type: "submit", size: "lg", fullWidth: true, disabled: loading, children: loading ? 'جارٍ الدخول…' : 'دخول' }), showServerField ? (_jsx("div", { className: styles.serverRow, children: _jsx(Input, { label: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062E\u0627\u062F\u0645", value: server, onChange: (e) => setServer(e.target.value), hint: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0630\u064A \u064A\u0634\u063A\u0651\u0644 \u0627\u0644\u062E\u0627\u062F\u0645 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0645\u062D\u0644\u064A\u0629", dir: "ltr", autoFocus: true }) })) : (_jsx("button", { type: "button", className: styles.serverToggle, onClick: () => setShowServerField(true), children: "\u062A\u063A\u064A\u064A\u0631 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062E\u0627\u062F\u0645" }))] })] }) }));
}
