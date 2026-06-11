import { CircleUser, Mail, Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { Form, useNavigation } from "react-router";

export type LeadActionData = { ok?: boolean; error?: string } | undefined;

export function LeadForm({ color, actionData }: { color: string; actionData: LeadActionData }) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.ok) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="w-10 h-10" style={{ color }} strokeWidth={1.5} />
        <h3 className="font-precision text-xl leading-6 tracking-[-0.3px] text-neutral-950">Demande envoyée</h3>
        <p className="text-sm leading-5 text-[#737373]">Merci, nos équipes vous recontacteront sous 24h ouvrables.</p>
      </div>
    );
  }

  return (
    <Form method="post" className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-precision text-xl leading-6 tracking-[-0.3px] text-neutral-950">Être contacté par un conseiller</h3>
        <p className="text-xs leading-4 text-[#737373]">Nos équipes vous recontacteront sous 24h ouvrables</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium leading-5 text-neutral-950">Nom complet *</label>
        <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <CircleUser className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
          <input name="fullName" type="text" required placeholder="Jean Dupont" className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium leading-5 text-neutral-950">E-mail *</label>
        <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <Mail className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
          <input name="email" type="email" required placeholder="email@exemple.fr" className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium leading-5 text-neutral-950">Téléphone *</label>
        <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <Smartphone className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
          <input name="phone" type="tel" required placeholder="05 61 03 80 04" className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium leading-5 text-neutral-950">Message</label>
        <textarea name="message" placeholder="Votre message" className="w-full text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-white border border-neutral-200 rounded-lg px-3 py-2 h-[76px] resize-y shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
      </div>

      <p className="text-xs leading-4 text-[#737373]">* champs obligatoires</p>

      {actionData?.error && (
        <p className="text-xs leading-4 text-red-700">{actionData.error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity disabled:opacity-80 disabled:cursor-not-allowed"
        style={{ backgroundColor: color }}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
            Envoi...
          </>
        ) : (
          "Demander à être contacté"
        )}
      </button>
    </Form>
  );
}