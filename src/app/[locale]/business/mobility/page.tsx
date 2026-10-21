import { accountTaskFromSearch } from "@/lib/account-task-resume";
import { managementProduct } from "@/lib/product-roles";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isLocale } from "@/lib/config";
import { RentalOperatorDesk } from "@/components/RentalOperatorDesk";
import { RentalMediaStudio } from "@/components/RentalMediaStudio";
import { RentalBranchProfile } from "@/components/RentalBranchProfile";
import { SpainAddressAutocomplete } from "@/components/SpainAddressAutocomplete";
import { rentalBranchMedia } from "@/lib/rental-media";
import {
  createRentalCompany,
  createRentalVehicle,
  updateRentalVehicle,
  createRentalBlock,
  removeRentalBlock,
  updateRentalBookingStatus,
} from "./actions";
import type {
  DeskVehicle,
  DeskBooking,
  DeskBlock,
} from "@/components/RentalOperatorDesk";
import styles from "@/components/AkiConduzco.module.css";
export default async function RentalBranchWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es",
    query = await searchParams;
  const { supabase } = await requireUser(
    locale,
    accountTaskFromSearch("hq", locale, "/business/mobility", query) ||
      "/business/mobility",
  );
  const { data: branches, error: branchError } = await supabase.rpc(
    "managed_rental_branches",
  );
  const company = query.new
    ? null
    : query.company
      ? (branches || []).find((c: { id: string }) => c.id === query.company)
      : (branches || [])[0];
  if (query.company && !company && !branchError) notFound();
  if (!company)
    return (
      <div className={styles.business}>
        <main className={styles.businessMain}>
          <Link href={`/${locale}/business`}>← {managementProduct.name}</Link>
          <section className={styles.businessCard}>
            <h1>{es ? "Tu sucursal AkiCoches" : "Your AkiCoches branch"}</h1>
            <p>
              {es
                ? "Un espacio independiente para tu negocio de alquiler, su flota y sus reservas."
                : "An independent space for your rental business, fleet and bookings."}
            </p>
            {(branchError || query.error) && (
              <p role="alert">
                {es
                  ? "No se pudo cargar o guardar la sucursal. Reintenta."
                  : "Could not load or save the branch. Please retry."}
              </p>
            )}
            <form action={createRentalCompany}>
              <input type="hidden" name="locale" value={locale} />
              <label>
                {es ? "Nombre de la sucursal" : "Branch name"}
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <SpainAddressAutocomplete
                locale={locale}
                mode="address"
                label={es ? "Dirección de recogida" : "Pick-up address"}
              />
              <SpainAddressAutocomplete
                locale={locale}
                mode="locality"
                name="city"
                label={es ? "Ciudad" : "City"}
              />
              <label>
                {es ? "Teléfono" : "Phone"}
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={40}
                />
              </label>
              <label>
                Web
                <input name="website" type="url" placeholder="https://" />
              </label>
              <button>
                {es
                  ? "Crear sucursal y enviar a revisión"
                  : "Create branch and submit for review"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  const [vehicleResult, bookingResult, mediaResult] = await Promise.all([
    supabase
      .from("car_rental_vehicles")
      .select(
        "id,name,category,transmission,fuel,seats,luggage,daily_price_cents,deposit_cents,active,image_url,rental_media_id",
      )
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("car_rental_bookings")
      .select(
        "id,vehicle_id,start_date,end_date,status,contact_name,contact_email,contact_phone,note,quoted_total_cents,vehicle:car_rental_vehicles!inner(company_id)",
      )
      .eq("vehicle.company_id", company.id)
      .eq("status", "requested")
      .order("created_at", { ascending: false })
      .limit(100),
    rentalBranchMedia(supabase, company.id, true),
  ]);
  const vehicles = (vehicleResult.data || []) as DeskVehicle[];
  const blockResult = vehicles.length
    ? await supabase
        .from("car_rental_calendar_blocks")
        .select("id,vehicle_id,start_date,end_date,reason", { count: "exact" })
        .in(
          "vehicle_id",
          vehicles.map((v) => v.id),
        )
        .gte("end_date", new Date().toISOString().slice(0, 10))
        .order("start_date")
        .limit(1000)
    : { data: [], error: null, count: 0 };
  return (
    <RentalOperatorDesk
      locale={locale}
      company={company}
      initialTab={query.tab}
      branches={branches || []}
      media={mediaResult.rows}
      mediaStudio={
        <RentalMediaStudio
          locale={locale}
          companyId={company.id}
          media={mediaResult.rows}
          importPending={mediaResult.importPending}
        />
      }
      companyTools={
        <RentalBranchProfile
          locale={locale}
          company={company}
          media={mediaResult.rows}
        />
      }
      vehicles={vehicles}
      bookings={(bookingResult.data || []) as unknown as DeskBooking[]}
      blocks={(blockResult.data || []) as DeskBlock[]}
      readError={Boolean(
        branchError ||
          vehicleResult.error ||
          bookingResult.error ||
          blockResult.error ||
          mediaResult.error ||
          blockResult.count === null ||
          (blockResult.count || 0) > (blockResult.data?.length || 0),
      )}
      feedback={
        query.error
          ? "error"
          : query.created || query.updated
            ? "success"
            : undefined
      }
      actions={{
        create: createRentalVehicle,
        update: updateRentalVehicle,
        block: createRentalBlock,
        booking: updateRentalBookingStatus,
        removeBlock: removeRentalBlock,
      }}
    />
  );
}
