export type AppTab = "chart" | "overview" | "option-chain";

interface TabNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: "chart", label: "Chart" },
  { id: "overview", label: "Overview" },
  { id: "option-chain", label: "Option Chain" },
];

export function TabNav({ active, onChange }: TabNavProps) {
  return (
    <nav className="border-b border-zinc-200 bg-white px-4 sm:px-6">
      <div className="flex gap-8">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative py-3.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[#4a69bd]"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4a69bd]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
