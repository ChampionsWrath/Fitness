import { Icon } from './ui';

const TABS = [
  { id: 'home', label: 'HOME', icon: 'home', href: '#/home' },
  { id: 'workout', label: 'WORKOUT', icon: 'workout', href: '#/workout' },
  { id: 'progress', label: 'PROGRESS', icon: 'progress', href: '#/progress' },
  { id: 'food', label: 'FOOD', icon: 'food', href: '#/food' },
  { id: 'exercises', label: 'EXERCISES', icon: 'library', href: '#/exercises' },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="inner">
        {TABS.map((t) => (
          <a key={t.id} href={t.href} className={active === t.id ? 'on' : ''} aria-current={active === t.id ? 'page' : undefined}>
            <Icon name={t.icon} />
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
