import Link from "next/link";

type Tab = {
  key: string;
  label: string;
  href: string;
};

export default function TabSwitcher({ tabs, activeKey }: { tabs: Tab[]; activeKey: string }) {
  return (
    <div className="tab-switcher">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`tab-switcher-item ${activeKey === tab.key ? "active" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
