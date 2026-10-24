import { Fragment, useState } from 'react';
import { Keyboard } from 'lucide-react';
import styles from './AppShell.module.css';
import { Dialog } from './ui/Dialog';

interface Shortcut {
  keys: string[];
  label: string;
}

/**
 * Only shortcuts the app really has — each one is wired up in the file named
 * beside its group. Add a line here whenever a new one is added there.
 */
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    // pages/Pos.tsx
    title: 'نقطة البيع',
    items: [
      { keys: ['F12'], label: 'إتمام البيع' },
      { keys: ['F4'], label: 'الانتقال إلى الخصم' },
      { keys: ['F8'], label: 'إخفاء / إظهار الأدوية' },
      { keys: ['↑', '↓', 'Enter'], label: 'اختيار دواء من النتائج وإضافته' },
      { keys: ['Esc'], label: 'إلغاء التحديد، ثم تفريغ السلة' },
    ],
  },
  {
    // pages/Inventory.tsx, pages/ProductDialog.tsx
    title: 'المخزون',
    items: [
      { keys: ['F1'], label: 'دواء جديد' },
      { keys: ['F2'], label: 'حفظ نافذة الدواء' },
    ],
  },
  {
    // components/ui/Toast.tsx, pages/Returns.tsx, Radix dialogs
    title: 'عام',
    items: [
      { keys: ['Ctrl', 'Z'], label: 'التراجع عن حذف (خلال ثوانٍ)' },
      { keys: ['Esc'], label: 'إغلاق النافذة / الرجوع من فاتورة الإرجاع' },
    ],
  },
];

/** The keyboard button in the top bar and the reference card it opens. */
export function ShortcutsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setOpen(true)}
        aria-label="اختصارات لوحة المفاتيح"
        title="اختصارات لوحة المفاتيح"
      >
        <Keyboard size={18} />
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="اختصارات لوحة المفاتيح">
        {GROUPS.map((group) => (
          <section key={group.title} className={styles.shortcutGroup}>
            <h3 className={styles.shortcutGroupTitle}>{group.title}</h3>
            <dl className={styles.shortcuts}>
              {group.items.map((item) => (
                <Fragment key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>
                    {item.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
      </Dialog>
    </>
  );
}
