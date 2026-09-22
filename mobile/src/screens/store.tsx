import { useState } from "react";
import { Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import { useApp } from "../core/state";
import * as api from "../core/api";
import { useResource } from "../core/use-resource";
import type {
  CommunityListingWrite,
  StoreCommunityListing,
  StoreInventoryItem,
  StoreInventoryItemWrite,
  StoreRegistrationRequest,
} from "../core/types";
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Page,
  Photo,
  confirmDelete,
} from "../ui/components";
import { colors, s } from "../ui/theme";
import { RequireAccount } from "./auth";
import type { ScreenProps } from "../navigation-types";

const registrationFields = [
  ["owner_display_name", "Tu nombre", "Your name"],
  ["owner_email", "Tu email", "Your email"],
  ["owner_password", "Contraseña", "Password"],
  ["legal_name", "Razón social", "Legal name"],
  ["display_name", "Nombre de la tienda", "Store name"],
  ["handle", "Identificador público", "Public handle"],
  ["jurisdiction", "Jurisdicción", "Jurisdiction"],
  ["business_identifier", "Identificación fiscal", "Business identifier"],
  ["address", "Dirección", "Address"],
  ["contact_email", "Email comercial", "Business email"],
  ["contact_phone", "Teléfono comercial", "Business phone"],
] as const;
export function StoreRegisterScreen({
  navigation,
}: ScreenProps<"StoreRegister">) {
  const { l, accept, auth } = useApp();
  const [draft, setDraft] = useState<StoreRegistrationRequest>(
    () =>
      Object.fromEntries(
        registrationFields.map(([key]) => [key, ""]),
      ) as StoreRegistrationRequest,
  );
  const [error, setError] = useState(false);
  if (auth)
    return (
      <Page>
        <Empty
          title={l(
            "Ya tenés una sesión abierta",
            "You already have an active session",
          )}
          body={l(
            "Cerrá tu sesión antes de registrar una nueva cuenta de tienda.",
            "Sign out before registering a new store account.",
          )}
        />
      </Page>
    );
  return (
    <Page>
      <Text style={s.eyebrow}>LOOKEATE PARA TIENDAS</Text>
      <Text style={s.title}>
        {l("Tu tienda,\nmás cerca.", "Your store,\ncloser.")}
      </Text>
      <Text style={s.muted}>
        {l(
          "Registrá tu negocio. La activación requiere verificar el email y la aprobación de Lookeate.",
          "Register your business. Activation requires email verification and Lookeate approval.",
        )}
      </Text>
      {registrationFields.map(([key, es, en]) => (
        <Field
          key={key}
          label={l(es, en)}
          value={draft[key]}
          secureTextEntry={key === "owner_password"}
          autoCapitalize={
            key.includes("email") ||
            key === "handle" ||
            key === "owner_password"
              ? "none"
              : "sentences"
          }
          keyboardType={
            key.includes("email")
              ? "email-address"
              : key === "contact_phone"
                ? "phone-pad"
                : "default"
          }
          onChangeText={(value) => setDraft((v) => ({ ...v, [key]: value }))}
        />
      ))}
      {error && (
        <Text style={{ color: colors.danger }}>
          {l(
            "No se pudo registrar la tienda. Revisá los datos y volvé a intentar.",
            "Could not register the store. Check your details and try again.",
          )}
        </Text>
      )}
      <Button
        title={l("Registrar tienda", "Register store")}
        disabled={
          Object.values(draft).some((v) => !v.trim()) ||
          draft.owner_password.length < 8 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.handle) ||
          !draft.owner_email.includes("@") ||
          !draft.contact_email.includes("@")
        }
        onPress={async () => {
          setError(false);
          try {
            accept(await api.registerStore(draft));
            setDraft((v) => ({ ...v, owner_password: "" }));
            navigation.replace("Store");
          } catch {
            setError(true);
            setDraft((v) => ({ ...v, owner_password: "" }));
          }
        }}
      />
    </Page>
  );
}
export function StoreScreen() {
  return (
    <RequireAccount>
      <Store />
    </RequireAccount>
  );
}
function Store() {
  const { auth, l, accept } = useApp();
  const [tab, setTab] = useState("inventory");
  const [code, setCode] = useState("");
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const store = auth?.selected_store;
  async function refresh() {
    accept(await api.restoreSession());
  }
  if (!store)
    return (
      <Page>
        <Empty
          title={l(
            "Esta cuenta no tiene una tienda",
            "This account has no store",
          )}
        />
      </Page>
    );
  if (store.status !== "active")
    return (
      <Page>
        <Text style={s.title}>{store.display_name}</Text>
        <View style={s.card}>
          <Text style={s.heading}>
            {store.status === "pending"
              ? l("Registro en revisión", "Registration under review")
              : store.status === "suspended"
                ? l("Tienda suspendida", "Store suspended")
                : l("Registro rechazado", "Registration rejected")}
          </Text>
          <Text style={s.muted}>
            {l(
              "La activación depende de la revisión de Lookeate. Contactá al equipo si necesitás ayuda.",
              "Activation depends on Lookeate review. Contact the team if you need help.",
            )}
          </Text>
          {store.status === "pending" && !store.email_verified && (
            <>
              <Field
                label={l(
                  "Código de verificación del email",
                  "Email verification code",
                )}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
              />
              <Button
                title={l("Verificar email", "Verify email")}
                disabled={!code.trim()}
                onPress={async () => {
                  accept(await api.verifyStoreEmail(code.trim()));
                  setCode("");
                }}
              />
            </>
          )}
          <Button
            title={l("Actualizar estado", "Refresh status")}
            secondary
            onPress={refresh}
          />
        </View>
      </Page>
    );
  return (
    <View style={s.fill}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={s.heading}>{store.display_name}</Text>
        <View style={s.row}>
          {["inventory", "community", "security"].map((key, i) => (
            <Chip
              key={key}
              title={
                [
                  l("Inventario", "Inventory"),
                  l("Comunidad", "Community"),
                  l("Seguridad", "Security"),
                ][i]
              }
              selected={tab === key}
              onPress={() => {
                setTab(key);
                setProvisioning(null);
                setMfaCode("");
              }}
            />
          ))}
        </View>
      </View>
      {tab === "inventory" ? (
        <Inventory />
      ) : tab === "community" ? (
        <StoreCommunity />
      ) : (
        <Page>
          <View style={s.card}>
            <Text style={s.heading}>
              {l("Autenticación de dos factores", "Two-factor authentication")}
            </Text>
            <Text style={s.muted}>
              {store.mfa_confirmed
                ? l(
                    "Tu segundo factor está confirmado.",
                    "Your second factor is confirmed.",
                  )
                : l(
                    "Configurá una app de autenticación para proteger operaciones sensibles.",
                    "Set up an authenticator app to protect sensitive operations.",
                  )}
            </Text>
            {!store.mfa_confirmed && (
              <>
                <Button
                  title={l("Configurar autenticador", "Set up authenticator")}
                  onPress={async () =>
                    setProvisioning(
                      (await api.enrollStoreMfa()).provisioning_uri,
                    )
                  }
                />
                {provisioning && (
                  <>
                    <Text style={s.muted}>
                      {l(
                        "Copiá la clave a tu app de autenticación. No la compartas.",
                        "Copy the key to your authenticator app. Do not share it.",
                      )}
                    </Text>
                    <Button
                      title={l(
                        "Copiar clave de configuración",
                        "Copy setup key",
                      )}
                      secondary
                      onPress={async () => {
                        const secret = new URL(provisioning).searchParams.get(
                          "secret",
                        );
                        if (secret) await Clipboard.setStringAsync(secret);
                      }}
                    />
                    <Field
                      label={l("Código del autenticador", "Authenticator code")}
                      value={mfaCode}
                      onChangeText={setMfaCode}
                      keyboardType="number-pad"
                      maxLength={8}
                    />
                    <Button
                      title={l("Confirmar", "Confirm")}
                      disabled={!/^\d{6,8}$/.test(mfaCode)}
                      onPress={async () => {
                        await api.confirmStoreMfa(mfaCode);
                        setProvisioning(null);
                        setMfaCode("");
                        await Clipboard.setStringAsync("");
                        await refresh();
                      }}
                    />
                  </>
                )}
              </>
            )}
            <Button
              title={l("Actualizar estado", "Refresh status")}
              secondary
              onPress={refresh}
            />
          </View>
        </Page>
      )}
    </View>
  );
}
const inventoryFields = [
  ["external_id", "SKU / ID externo", "SKU / external ID"],
  ["product_display_name", "Nombre del producto", "Product name"],
  ["price", "Precio", "Price"],
  ["brand", "Marca", "Brand"],
  ["gender", "Género", "Gender"],
  ["master_category", "Categoría", "Category"],
  ["sub_category", "Subcategoría", "Subcategory"],
  ["article_type", "Tipo de prenda", "Article type"],
  ["base_colour", "Color principal", "Base color"],
  ["colour1", "Color secundario", "Secondary color"],
  ["colour2", "Otro color", "Other color"],
  ["season", "Temporada", "Season"],
  ["year", "Año", "Year"],
  ["usage", "Uso", "Usage"],
  ["description", "Descripción", "Description"],
  ["image_default", "Imagen principal (URL)", "Main image (URL)"],
  ["image_front", "Imagen frontal (URL)", "Front image (URL)"],
  ["image_back", "Imagen trasera (URL)", "Back image (URL)"],
  ["image_top", "Imagen superior (URL)", "Top image (URL)"],
  ["image_left", "Imagen izquierda (URL)", "Left image (URL)"],
  ["image_right", "Imagen derecha (URL)", "Right image (URL)"],
  ["image_search", "Imagen de búsqueda (URL)", "Search image (URL)"],
] as const;
function Inventory() {
  const { l } = useApp();
  const result = useResource(api.listStoreInventory);
  const [editing, setEditing] = useState<StoreInventoryItem | "new" | null>(
    null,
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [importItems, setImportItems] = useState<
    StoreInventoryItemWrite[] | null
  >(null);
  function edit(item: StoreInventoryItem | "new") {
    setEditing(item);
    setDraft(
      item === "new"
        ? {}
        : {
            ...Object.fromEntries(
              inventoryFields.map(([key]) => [
                key,
                item[key] == null ? "" : String(item[key]),
              ]),
            ),
            details: JSON.stringify(item.details ?? {}, null, 2),
          },
    );
  }
  async function save() {
    const value: StoreInventoryItemWrite = {
      external_id: draft.external_id.trim(),
      product_display_name: draft.product_display_name.trim(),
      details: JSON.parse(draft.details || "{}"),
    };
    for (const [key] of inventoryFields) {
      if (key === "external_id" || key === "product_display_name") continue;
      Object.assign(value, {
        [key]:
          key === "price" || key === "year"
            ? draft[key]?.trim()
              ? Number(draft[key])
              : null
            : draft[key]?.trim() || null,
      });
    }
    if (editing === "new") await api.createStoreInventoryItem(value);
    else if (editing) await api.updateStoreInventoryItem(editing.id, value);
    setEditing(null);
    await result.reload();
  }
  const invalidNumber = (key: string) =>
    Boolean(
      draft[key] &&
      (!Number.isFinite(Number(draft[key])) || Number(draft[key]) < 0),
    );
  return (
    <Page>
      <Text style={s.title}>{l("Tu inventario", "Your inventory")}</Text>
      <Button
        title={l("Agregar producto", "Add product")}
        icon="add"
        onPress={() => edit("new")}
      />
      <Button
        title={l("Importar archivo JSON", "Import JSON file")}
        secondary
        icon="document-outline"
        onPress={async () => {
          const picked = await DocumentPicker.getDocumentAsync({
            type: ["application/json", "text/plain"],
            copyToCacheDirectory: true,
          });
          if (picked.canceled) return;
          if ((picked.assets[0].size ?? 0) > 5_000_000)
            throw new Error("File too large");
          const parsed = JSON.parse(
            await new File(picked.assets[0].uri).text(),
          );
          const items = Array.isArray(parsed) ? parsed : parsed.items;
          if (
            !Array.isArray(items) ||
            !items.length ||
            items.length > 2000 ||
            items.some((item) => !item || typeof item !== "object")
          )
            throw new Error("Invalid inventory");
          setImportItems(items);
        }}
      />
      {importItems && (
        <View style={s.card}>
          <Text style={s.heading}>
            {l("Revisar importación", "Review import")}
          </Text>
          <Text style={s.text}>
            {importItems.length}{" "}
            {l(
              "productos. Los SKU existentes se actualizarán.",
              "products. Existing SKUs will be updated.",
            )}
          </Text>
          {importItems.slice(0, 5).map((item, index) => (
            <Text key={index} style={s.muted}>
              {item.external_id}: {item.product_display_name}
            </Text>
          ))}
          <Button
            title={l("Confirmar importación", "Confirm import")}
            onPress={async () => {
              const imported = await api.importStoreInventory(importItems);
              setNotice(
                `${imported.created_count} ${l("creados", "created")} · ${imported.updated_count} ${l("actualizados", "updated")}`,
              );
              setImportItems(null);
              await result.reload();
            }}
          />
          <Button
            title={l("Cancelar", "Cancel")}
            secondary
            onPress={() => setImportItems(null)}
          />
        </View>
      )}
      {notice && <Text style={{ color: colors.accent }}>{notice}</Text>}
      {editing && (
        <View style={s.card}>
          <Text style={s.heading}>
            {editing === "new"
              ? l("Nuevo producto", "New product")
              : l("Editar producto", "Edit product")}
          </Text>
          {inventoryFields.map(([key, es, en]) => (
            <Field
              key={key}
              label={l(es, en)}
              value={draft[key] ?? ""}
              onChangeText={(value) =>
                setDraft((v) => ({ ...v, [key]: value }))
              }
              keyboardType={
                key === "price" || key === "year" ? "decimal-pad" : "default"
              }
              autoCapitalize={key.startsWith("image_") ? "none" : "sentences"}
              multiline={key === "description"}
            />
          ))}
          <Field
            label={l(
              "Detalles adicionales (JSON)",
              "Additional details (JSON)",
            )}
            value={draft.details ?? "{}"}
            onChangeText={(details) => setDraft((v) => ({ ...v, details }))}
            multiline
            autoCapitalize="none"
          />
          <Button
            title={l("Guardar producto", "Save product")}
            disabled={
              !draft.external_id?.trim() ||
              !draft.product_display_name?.trim() ||
              invalidNumber("price") ||
              invalidNumber("year")
            }
            onPress={save}
          />
          <Button
            title={l("Cancelar", "Cancel")}
            secondary
            onPress={() => setEditing(null)}
          />
        </View>
      )}
      <Field
        label={l("Buscar en mi inventario", "Search my inventory")}
        value={query}
        onChangeText={setQuery}
      />
      {result.loading && <Loading />}
      {result.error && (
        <Empty
          title={l(
            "No pudimos cargar tu inventario",
            "Could not load inventory",
          )}
          retry={() => void result.reload()}
        />
      )}
      {result.data
        ?.filter((item) =>
          `${item.product_display_name} ${item.external_id}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((item) => (
          <View key={item.id} style={s.card}>
            <Photo uri={item.image_default || item.image_front} size={170} />
            <Text style={s.heading}>{item.product_display_name}</Text>
            <Text style={s.muted}>
              {item.external_id} ·{" "}
              {item.price == null ? "—" : `$ ${item.price}`}
            </Text>
            <Button
              title={l("Editar", "Edit")}
              secondary
              onPress={() => edit(item)}
            />
            <Button
              title={l("Eliminar", "Delete")}
              secondary
              onPress={() =>
                confirmDelete(
                  l("Eliminar producto", "Delete product"),
                  item.product_display_name,
                  async () => {
                    await api.deleteStoreInventoryItem(item.id);
                    await result.reload();
                  },
                  l("Cancelar", "Cancel"),
                  l("Eliminar", "Delete"),
                )
              }
            />
          </View>
        ))}
      {!result.loading && result.data?.length === 0 && (
        <Empty
          title={l("Tu inventario está vacío", "Your inventory is empty")}
        />
      )}
    </Page>
  );
}
function StoreCommunity() {
  const { l } = useApp();
  const result = useResource(api.listStoreCommunityListings);
  const [editing, setEditing] = useState<StoreCommunityListing | "new" | null>(
    null,
  );
  const [draft, setDraft] = useState<CommunityListingWrite>({
    kind: "blog",
    title: "",
  });
  function edit(item: StoreCommunityListing | "new") {
    setEditing(item);
    setDraft(
      item === "new"
        ? { kind: "blog", title: "" }
        : {
            kind: item.kind,
            title: item.title,
            description: item.description,
            location: item.location,
            external_url: item.external_url,
            starts_at: item.starts_at,
            ends_at: item.ends_at,
            join_code: item.join_code,
          },
    );
  }
  const fields = [
    ["title", "Título", "Title"],
    ["description", "Descripción", "Description"],
    ["location", "Ubicación", "Location"],
    ["external_url", "Enlace externo", "External link"],
    [
      "starts_at",
      "Inicio (ISO: 2026-09-30T18:00:00-03:00)",
      "Start (ISO: 2026-09-30T18:00:00-03:00)",
    ],
    ["ends_at", "Fin (fecha ISO)", "End (ISO date)"],
    ["join_code", "Código de invitación", "Invitation code"],
  ] as const;
  return (
    <Page>
      <Text style={s.title}>
        {l("La comunidad\nde tu tienda.", "Your store’s\ncommunity.")}
      </Text>
      <Button
        title={l("Crear publicación", "Create listing")}
        icon="add"
        onPress={() => edit("new")}
      />
      {editing && (
        <View style={s.card}>
          <View style={s.row}>
            {(["blog", "event", "space"] as const).map((kind, i) => (
              <Chip
                key={kind}
                title={["Blog", l("Evento", "Event"), l("Espacio", "Space")][i]}
                selected={draft.kind === kind}
                onPress={() => setDraft((v) => ({ ...v, kind }))}
              />
            ))}
          </View>
          {fields.map(([key, es, en]) => (
            <Field
              key={key}
              label={l(es, en)}
              value={draft[key] ?? ""}
              onChangeText={(value) =>
                setDraft((v) => ({ ...v, [key]: value || null }))
              }
              multiline={key === "description"}
              autoCapitalize={
                key === "external_url" || key === "join_code"
                  ? "none"
                  : "sentences"
              }
            />
          ))}
          <Button
            title={l("Guardar publicación", "Save listing")}
            disabled={
              !draft.title?.trim() ||
              (draft.kind === "event" && !draft.starts_at)
            }
            onPress={async () => {
              if (editing === "new")
                await api.createStoreCommunityListing(draft);
              else await api.updateStoreCommunityListing(editing.id, draft);
              setEditing(null);
              await result.reload();
            }}
          />
          <Button
            title={l("Cancelar", "Cancel")}
            secondary
            onPress={() => setEditing(null)}
          />
        </View>
      )}
      {result.loading && <Loading />}
      {result.error && (
        <Empty
          title={l(
            "No pudimos cargar las publicaciones",
            "Could not load listings",
          )}
          retry={() => void result.reload()}
        />
      )}
      {result.data?.map((item) => (
        <View style={s.card} key={item.id}>
          <Text style={s.eyebrow}>{item.kind}</Text>
          <Text style={s.heading}>{item.title}</Text>
          <Text style={s.text}>{item.description}</Text>
          {item.join_code && (
            <Text style={s.muted}>
              {l("Invitación", "Invitation")}: {item.join_code}
            </Text>
          )}
          <Button
            title={l("Editar", "Edit")}
            secondary
            onPress={() => edit(item)}
          />
          <Button
            title={l("Eliminar", "Delete")}
            secondary
            onPress={() =>
              confirmDelete(
                l("Eliminar publicación", "Delete listing"),
                item.title,
                async () => {
                  await api.deleteStoreCommunityListing(item.id);
                  await result.reload();
                },
                l("Cancelar", "Cancel"),
                l("Eliminar", "Delete"),
              )
            }
          />
        </View>
      ))}
      {!result.loading && result.data?.length === 0 && (
        <Empty title={l("Todavía no hay publicaciones", "No listings yet")} />
      )}
    </Page>
  );
}
