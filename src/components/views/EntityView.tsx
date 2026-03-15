import { useState, type ComponentType, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/context/AppContext";
import type { EntityName, BaseRecord } from "@/types";

interface EntityViewProps<T extends BaseRecord> {
  title: string;
  subtitle?: string;
  entity: EntityName;
  FormComp: ComponentType<{ initialData?: Partial<T>; onSave: (d: Partial<T>) => void; onCancel: () => void; [k: string]: unknown }>;
  formProps?: Record<string, unknown>;
  formTitle?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}

export function EntityView<T extends BaseRecord>({ title, subtitle, entity, FormComp, formProps = {}, formTitle, children, headerRight }: EntityViewProps<T>) {
  const { save } = useApp();
  const [open, setOpen] = useState(false);

  const handleSave = async (data: Partial<T>) => {
    await save(entity, data as Partial<BaseRecord>);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formTitle ?? `Add ${title}`}</DialogTitle>
          </DialogHeader>
          <FormComp {...formProps} onSave={handleSave} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
