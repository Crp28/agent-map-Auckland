type PropertyViewSwitchProps = {
  active: "properties" | "soldProperties";
  onShowProperties?: () => void;
  onShowSoldProperties?: () => void;
};

const baseClass =
  "min-h-11 border-b-2 px-1 pb-2 pt-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0056a7] focus:ring-offset-2";

export function PropertyViewSwitch({
  active,
  onShowProperties,
  onShowSoldProperties,
}: PropertyViewSwitchProps) {
  return (
    <nav aria-label="Property record view" className="border-b border-[#e2e8f0]">
      <p className="text-xs font-semibold uppercase text-[#64748b]">Record view</p>
      <div className="mt-1 flex gap-5">
        <button
          type="button"
          aria-pressed={active === "properties"}
          onClick={onShowProperties}
          disabled={active === "properties"}
          className={`${baseClass} ${
            active === "properties"
              ? "border-[#0056a7] text-[#0056a7]"
              : "border-transparent text-[#475569] hover:border-[#94a3b8] hover:text-[#111827]"
          } disabled:cursor-default`}
        >
          Properties
        </button>
        <button
          type="button"
          aria-pressed={active === "soldProperties"}
          onClick={onShowSoldProperties}
          disabled={active === "soldProperties"}
          className={`${baseClass} ${
            active === "soldProperties"
              ? "border-[#0056a7] text-[#0056a7]"
              : "border-transparent text-[#475569] hover:border-[#94a3b8] hover:text-[#111827]"
          } disabled:cursor-default`}
        >
          Sold properties
        </button>
      </div>
    </nav>
  );
}
