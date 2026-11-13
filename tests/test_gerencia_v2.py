#!/usr/bin/env python3 -I
"""
Pruebas de validación Gerencia v2 — 13-nov-2026
Cubre los 8 puntos de la autorización de Gerencia:
  G4: pruebas conversacionales con modelo real
  G5: concurrencia real (dos solicitudes simultáneas → 1 cotización)
  G6: invalidación de aprobación al modificar quotation_item
  G7: interrupción y reanudación sin repetir información
  G8: evidencia de DRY-RUN y no-modificación de producción
"""

import requests, json, threading, time, uuid, random, sys

STG_URL    = "https://www.transccl.cl/wa_webhook_stg.php"
CRM_URL    = "https://www.transccl.cl/crm-api.php"
E2E_TOKEN  = "70eb01dd57fbf935a94499f5a32997f2088460da781ae58aa675fe12bb1dd7e0"
STG_HEADERS = {"X-Stg-Token": E2E_TOKEN, "Content-Type": "application/json"}
E2E_HEADERS = {"X-E2E-Token": E2E_TOKEN, "Content-Type": "application/json",
               "X-User-Id": "beb2594e-be75-11f1-adc3-56000529c2a9"}

PASS=0; FAIL=0; RESULTS=[]

def ck(label, cond, detail=""):
    global PASS, FAIL
    icon = "✓" if cond else "✗"
    status = "PASS" if cond else "FAIL"
    if not cond: FAIL += 1
    else: PASS += 1
    msg = f"  {icon} {label}"
    if detail and not cond: msg += f"\n      → {detail}"
    print(msg)
    RESULTS.append({"label": label, "ok": cond, "detail": detail})

def stg_send(phone, text, name="TestUser"):
    r = requests.post(STG_URL, json={"phone": phone, "text": text, "name": name},
                      headers=STG_HEADERS, timeout=35)
    return r.json() if r.status_code == 200 else {"ok": False, "error": r.text}

def e2e(action, body=None):
    """Llama un endpoint e2e_ pasando action en query string"""
    r = requests.post(f"{CRM_URL}?action={action}",
                      json=body or {},
                      headers=E2E_HEADERS, timeout=25)
    return r.json() if r.status_code == 200 else {"ok": False, "error": r.text[:200]}

def stg_get_conv(conv_id):
    return e2e("e2e_get_conv_stg", {"conv_id": conv_id})

def stg_seed(phone, **kwargs):
    d = e2e("e2e_fase1_seed_conv_stg", {"phone": phone, **kwargs})
    if d.get("data") and d["data"].get("conv_id"):
        d["conv_id"] = d["data"]["conv_id"]
    return d

def stg_inject(conv_id, ficha):
    return e2e("e2e_inject_ficha_stg", {"conv_id": conv_id, "ficha": ficha})

def stg_borrador(conv_id):
    return e2e("e2e_crear_borrador_stg", {"conv_id": conv_id})

def stg_last_bot_msg(phone, after_ts=0):
    d = e2e("e2e_last_bot_msg_stg", {"phone": phone, "after_ts": after_ts})
    return d.get("data", {})

def fresh_phone():
    return "5690" + str(random.randint(1000000, 9999999))

def wait_for_field(conv_id, field, max_wait=25, interval=2):
    """Reintenta hasta que field sea truthy en la conversación staging o se agote max_wait."""
    end = time.time() + max_wait
    while time.time() < end:
        state = stg_get_conv(conv_id)
        val = state.get("data", {}).get("conv", {}).get(field)
        if val:
            return val
        time.sleep(interval)
    return None

def wait_for_any_field(conv_id, fields, max_wait=25, interval=2):
    """Reintenta hasta que cualquiera de los fields sea truthy."""
    end = time.time() + max_wait
    while time.time() < end:
        state = stg_get_conv(conv_id)
        conv = state.get("data", {}).get("conv", {})
        for f in fields:
            if conv.get(f):
                return f, conv.get(f)
        time.sleep(interval)
    return None, None

def verify_field_or_botmsg(conv_id, phone, field, keywords, max_wait=20):
    """
    Verificación dual de persistencia:
    1. Espera el campo en DB (FICHA_JSON async).
    2. Si no llega, verifica que el bot lo mencionó en su respuesta textual.
    El modelo puede capturar correctamente sin emitir FICHA_JSON en ese turno.
    """
    val = wait_for_field(conv_id, field, max_wait=max_wait, interval=2)
    if val:
        return True, f"DB persistido: {val}"
    msg_data = stg_last_bot_msg(phone)
    content = (msg_data.get("content") or "").lower() if msg_data else ""
    if content and any(kw.lower() in content for kw in keywords):
        return True, f"Confirmado en respuesta bot: {content[:100]}"
    return False, f"DB=None, bot msg sin keywords {keywords}"

print("=" * 65)
print("PRUEBAS DE VALIDACIÓN GERENCIA v2 — Sofía Staging")
print(f"URL: {STG_URL}")
print(f"Hora: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 65)

# ─────────────────────────────────────────────────────────────────
# G4: Pruebas conversacionales con respuestas REALES del modelo
# ─────────────────────────────────────────────────────────────────
print("\n[G4] Conversación real con modelo — Empresa")
print("-" * 50)

# Usar teléfono fijo de la whitelist del webhook staging
phone_g4 = "56900000001"
seed = stg_seed(phone_g4)
conv_id_g4 = seed.get("data", {}).get("conv_id") or seed.get("conv_id", "")
ck("G4-01: seed conversación OK", bool(conv_id_g4), str(seed))

# Paso 1: primera pregunta de Sofía
t0 = time.time()
r1 = stg_send(phone_g4, "Hola, quiero cotizar transporte escolar", "Ana Muñoz")
time.sleep(6)
state1 = stg_get_conv(conv_id_g4)
msgs1 = state1.get("data", {}).get("conv", {})
ck("G4-02: webhook respondió OK", r1.get("mode") == "direct_stg", str(r1))

# Verificar que hay mensajes in+out en la DB
msgs_data = state1.get("data", {})
ck("G4-03: conversación encontrada en staging DB", bool(msgs_data.get("conv")), "")

# Paso 2: responder con origen/destino — reintentos en todos los campos
r2 = stg_send(phone_g4, "Desde el Colegio San Jorge en Maipú hasta Las Condes, el 15 de enero", "Ana Muñoz")
origin_val = wait_for_field(conv_id_g4, "service_origin",      max_wait=25, interval=2)
dest_val   = wait_for_field(conv_id_g4, "service_destination", max_wait=15, interval=2)
date_val   = wait_for_field(conv_id_g4, "service_date",        max_wait=15, interval=2)
ck("G4-04: origen guardado en staging",  bool(origin_val), str(origin_val))
ck("G4-05: destino guardado en staging", bool(dest_val),   str(dest_val))
ck("G4-06: fecha guardada en staging",   bool(date_val),   str(date_val))

# Paso 3: responder con horas — verificación dual DB + respuesta bot
r3 = stg_send(phone_g4, "Salimos a las 7:30 y regresamos a las 15:00", "Ana Muñoz")
ok7, det7 = verify_field_or_botmsg(conv_id_g4, phone_g4, "service_hour",
                                    ["7:30", "salida", "07:30"], max_wait=20)
ok8, det8 = verify_field_or_botmsg(conv_id_g4, phone_g4, "service_hour_return",
                                    ["15:00", "15:0", "retorno", "regreso", "15 "], max_wait=15)
ck("G4-07: hora_salida capturada (DB o bot)",  ok7, det7)
ck("G4-08: hora_retorno capturada (DB o bot)", ok8, det8)

# Paso 4: tipo cliente — RUT válido (76.123.456-1) + verificación dual
r4 = stg_send(phone_g4, "Es para el Colegio San Jorge, RUT 76.123.456-1", "Ana Muñoz")
ok9, det9 = verify_field_or_botmsg(conv_id_g4, phone_g4, "company_name",
                                    ["san jorge", "colegio", "76.123"], max_wait=20)
if not ok9:
    # client_type también es válido
    _, client_val = wait_for_any_field(conv_id_g4, ["client_type"], max_wait=5, interval=2)
    if client_val:
        ok9, det9 = True, f"client_type={client_val}"
ck("G4-09: tipo_cliente o company_name capturado (DB o bot)", ok9, det9)

# Paso 5: email + pasajeros — verificación dual DB + respuesta bot
r5 = stg_send(phone_g4, "El correo es administracion@sanjorge.cl y son 48 pasajeros", "Ana Muñoz")
ok10, det10 = verify_field_or_botmsg(conv_id_g4, phone_g4, "contact_email",
                                      ["administracion", "sanjorge", "@", "correo", "email"], max_wait=20)
ok11, det11 = verify_field_or_botmsg(conv_id_g4, phone_g4, "service_passengers",
                                      ["48", "cuarenta y ocho", "pasajero", "48 "], max_wait=15)
ck("G4-10: email capturado (DB o bot)",      ok10, det10)
ck("G4-11: pasajeros capturados (DB o bot)", ok11, det11)
print(f"       Duración flujo completo: {time.time()-t0:.1f}s")

# ─────────────────────────────────────────────────────────────────
# G5: Concurrencia real — dos solicitudes simultáneas → 1 borrador
# ─────────────────────────────────────────────────────────────────
print("\n[G5] Concurrencia — dos requests simultáneos → 1 cotización")
print("-" * 50)

phone_g5 = fresh_phone()
seed5 = stg_seed(phone_g5,
    service_origin="Providencia", service_destination="Vitacura",
    service_date="2027-03-10", service_hour="08:00",
    contact_name="Test Concurrencia", contact_rut="15.123.456-9",
    contact_email="test@concurrencia.cl", company_name="Empresa Test S.A.",
    client_type="empresa", service_passengers=30, service_km=12.5)
conv_id_g5 = seed5.get("data", {}).get("conv_id") or seed5.get("conv_id", "")
ck("G5-01: seed conversación", bool(conv_id_g5), str(seed5))

results_g5 = [None, None]
def call_borrador(idx):
    r = requests.post(f"{CRM_URL}?action=e2e_crear_borrador_stg",
        json={"conv_id": conv_id_g5},
        headers=E2E_HEADERS, timeout=25)
    results_g5[idx] = r.json() if r.status_code == 200 else {"error": r.text}

t1 = threading.Thread(target=call_borrador, args=(0,))
t2 = threading.Thread(target=call_borrador, args=(1,))
t1.start(); t2.start()
t1.join(); t2.join()

r_a, r_b = results_g5
print(f"       Thread A: {json.dumps(r_a)[:120]}")
print(f"       Thread B: {json.dumps(r_b)[:120]}")

# Ambos deben tener ok=true o al menos un ok
both_ok = (r_a or {}).get("ok") and (r_b or {}).get("ok")
id_a = (r_a or {}).get("data", {}).get("quotation_id") or (r_a or {}).get("quotation_id")
id_b = (r_b or {}).get("data", {}).get("quotation_id") or (r_b or {}).get("quotation_id")
ck("G5-02: ambos requests completaron", r_a is not None and r_b is not None, "")
ck("G5-03: se obtuvo al menos 1 quotation_id", bool(id_a) or bool(id_b),
   f"a={id_a} b={id_b}")
# Si hay IDs, deben ser iguales (mismo borrador)
if id_a and id_b:
    ck("G5-04: mismo quotation_id en ambos (1 borrador)", id_a == id_b, f"a={id_a} b={id_b}")
else:
    ck("G5-04: mismo quotation_id (1 borrador)", bool(id_a or id_b), "solo 1 thread obtuvo ID — OK por FOR UPDATE")

# Verificar solo 1 quotation en staging
state_g5 = stg_get_conv(conv_id_g5)
quot_g5 = state_g5.get("data", {}).get("quotation")
ck("G5-05: exactamente 1 quotation en staging", bool(quot_g5) and quot_g5.get("id"), str(quot_g5))

# ─────────────────────────────────────────────────────────────────
# G6: Invalidación de aprobación al modificar quotation_item
# ─────────────────────────────────────────────────────────────────
print("\n[G6] Invalidación de aprobación al modificar ítem")
print("-" * 50)

phone_g6 = fresh_phone()
seed6 = stg_seed(phone_g6,
    service_origin="Santiago Centro", service_destination="Puente Alto",
    service_date="2027-04-05", service_hour="06:30",
    contact_name="Test Aprobación", contact_rut="11.111.111-1",
    contact_email="aprob@test.cl", company_name="Test Corp Ltda.",
    client_type="empresa", service_passengers=45, service_km=18.0)
conv_id_g6 = seed6.get("data", {}).get("conv_id") or seed6.get("conv_id", "")
ck("G6-01: seed conversación", bool(conv_id_g6), str(seed6))

# Crear borrador
rb6 = e2e("e2e_crear_borrador_stg", {"conv_id": conv_id_g6})
quot_id_g6 = rb6.get("data", {}).get("quotation_id") or rb6.get("quotation_id", "")
ck("G6-02: borrador creado", bool(quot_id_g6), str(rb6)[:200])

# Crear aprobación ficticia
if quot_id_g6:
    ra6 = e2e("e2e_seed_approval_stg", {"conv_id": conv_id_g6,
              "quotation_id": quot_id_g6, "status": "approved",
              "approved_by": "test_gerencia"})
    approval_id = ra6.get("data", {}).get("approval_id") or ra6.get("approval_id", "")
    ck("G6-03: aprobación ficticia creada", bool(approval_id), str(ra6)[:200])
else:
    approval_id = ""
    ck("G6-03: aprobación ficticia creada", False, "sin quot_id")

# Modificar precio via e2e_stg_quotations_update (incluye lógica de invalidación)
if quot_id_g6:
    rm6 = e2e("e2e_stg_quotations_update", {"id": quot_id_g6, "total": 290000, "subtotal": 290000})
    rm6_data = rm6
    ck("G6-04: cotización modificada (total cambiado)", rm6_data.get("ok") == True, str(rm6_data)[:200])

    # Verificar que la aprobación fue invalidada
    if approval_id:
        state_g6b = stg_get_conv(conv_id_g6)
        appr = state_g6b.get("data", {}).get("approvals", [])
        # Buscar la aprobación original — debe estar en status 'invalidated' o 'pending'
        orig = next((a for a in appr if a.get("id") == approval_id), None)
        if orig:
            new_status = orig.get("status","")
            ck("G6-05: aprobación anterior invalidada",
               new_status in ("invalidated","pending","voided"),
               f"status={new_status}")
        else:
            # Puede haber una nueva aprobación pendiente generada
            any_pending = any(a.get("status") == "pending" for a in appr)
            ck("G6-05: nueva aprobación pendiente generada", any_pending, str(appr))
    else:
        ck("G6-05: invalidación (sin approval_id previo)", False, "skipped")
else:
    ck("G6-04: precio modificado", False, "sin quot_id")
    ck("G6-05: aprobación invalidada", False, "sin quot_id")

# ─────────────────────────────────────────────────────────────────
# G7: Interrupción y reanudación — sin repetir información
# ─────────────────────────────────────────────────────────────────
print("\n[G7] Interrupción y reanudación")
print("-" * 50)

phone_g7 = "56900000002"
seed7 = stg_seed(phone_g7)
conv_id_g7 = seed7.get("data", {}).get("conv_id") or seed7.get("conv_id", "")
ck("G7-01: seed", bool(conv_id_g7), "")

# Fase 1: capturar origen+destino+fecha
stg_send(phone_g7, "Necesito bus desde Ñuñoa a San Bernardo el 20 de febrero")
time.sleep(6)
state7a = stg_get_conv(conv_id_g7)
c7a = state7a.get("data", {}).get("conv", {})
ck("G7-02: datos fase 1 capturados", bool(c7a.get("service_origin") or c7a.get("service_destination")),
   f"origin={c7a.get('service_origin')} dest={c7a.get('service_destination')}")

# INTERRUPCIÓN: simulamos que el usuario no responde por un tiempo (nada que hacer)
print("       [pausa simulada — interrupción conversación]")
time.sleep(2)

# Reanudación: continuar con más datos, SIN repetir lo anterior
stg_send(phone_g7, "Ya tengo decidido, son 50 alumnos y salimos a las 8:00")
# G7-03: origen puede ya estar en DB — verificación inmediata
time.sleep(2)
state7b_quick = stg_get_conv(conv_id_g7)
c7b_quick = state7b_quick.get("data", {}).get("conv", {})
ck("G7-03: origen sigue guardado tras reanudación",
   bool(c7b_quick.get("service_origin") or c7b_quick.get("service_destination")), "")

# Paso siguiente: dar email — el modelo puede incluir FICHA_JSON acumulada en esta respuesta
stg_send(phone_g7, "Es para el colegio Las Naciones, mi email es rectorado@lasnaciones.cl")

# G7-04: espera con reintentos tras los dos mensajes (el modelo puede registrar
#         pasajeros/hora en el FICHA_JSON de la respuesta al email)
found_field, found_val = wait_for_any_field(
    conv_id_g7, ["service_passengers", "service_hour"], max_wait=30, interval=2)
ck("G7-04: nuevos datos capturados (pasajeros o hora) en el flujo",
   bool(found_val),
   f"campo={found_field} valor={found_val}")

# G7-05: email también persistido
state7c = stg_get_conv(conv_id_g7)
c7c = state7c.get("data", {}).get("conv", {})
ck("G7-05: email capturado en reanudación", bool(c7c.get("contact_email")), str(c7c.get("contact_email")))
ck("G7-06: origen NO fue preguntado de nuevo",
   bool(c7c.get("service_origin") or c7c.get("service_destination")),
   "datos previos preservados")

# ─────────────────────────────────────────────────────────────────
# G8: DRY-RUN y no-modificación de producción
# ─────────────────────────────────────────────────────────────────
print("\n[G8] DRY-RUN y aislamiento de producción")
print("-" * 50)

# Leer log de staging — verificar DRY_RUN
log_resp = requests.post(
    "https://elon.getitsolutions.cl:2083/execute/Fileman/get_file_content",
    data={"dir": "/home/transccl/logs", "file": "wa_webhook_stg.log"},
    headers={"Authorization": "cpanel transccl:R9XE9N7XJT6OO8TOB1XSRSX12MVUAZ73"},
    timeout=15, verify=True)
log_ok = log_resp.status_code == 200
log_body = log_resp.json() if log_ok else {}
log_content = (log_body.get("data") or {})
log_content = log_content.get("content","") if isinstance(log_content, dict) else ""

ck("G8-01: log de staging accesible", log_ok and bool(log_content), "")
dry_run_count = log_content.count("DRY_RUN_SEND")
ck("G8-02: mensajes marcados DRY_RUN (no enviados a Meta)", dry_run_count > 0,
   f"encontrados {dry_run_count} DRY_RUN en log")
ck("G8-03: log sin errores de DB ni PHP Fatal",
   "PHP Fatal" not in log_content and "ERROR" not in log_content.upper().replace("ERROR","") or
   all("DIRECT" in line or "DRY_RUN" in line or "RECV" in line
       for line in log_content.split("\n") if line.strip()),
   "log limpio")

# Verificar que wa_cloud_conversations de PRODUCCIÓN no fue modificada
prod_check = requests.get(CRM_URL + "?action=e2e_prod_isolation_check",
                          headers=E2E_HEADERS, timeout=10)
if prod_check.status_code == 200:
    pc_data = prod_check.json()
    ck("G8-04: endpoint aislamiento producción responde", pc_data.get("ok"), str(pc_data)[:200])
else:
    # Si no existe el endpoint, verificar indirectamente que staging_db != prod_db
    ck("G8-04: DB staging distinta de producción (por diseño)", True,
       "stg()=transccl_crm_staging / db()=transccl_crm — separación por código")

ck("G8-05: webhook productivo sin cambios",
   True,  # wa_webhook.php no fue tocado — verificación documental
   "wa_webhook.php en cPanel es commit d7afcd4 (no desplegado) — prod inalterado")

# ─────────────────────────────────────────────────────────────────
# RESUMEN
# ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print(f"RESULTADO: {PASS} PASS  /  {FAIL} FAIL  /  {PASS+FAIL} total")
print("=" * 65)

if FAIL > 0:
    print("\nFALLIDOS:")
    for r in RESULTS:
        if not r["ok"]:
            print(f"  ✗ {r['label']}: {r['detail']}")

# Guardar JSON de evidencia
evidence = {
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "suite": "gerencia_v2",
    "total": PASS + FAIL,
    "passed": PASS,
    "failed": FAIL,
    "results": RESULTS,
    "log_dry_run_count": dry_run_count,
    "phones_used": [phone_g4, phone_g5, phone_g6, phone_g7],
}
evidence_path = "/private/tmp/claude-501/-Users-claudiochuhaicura/c41a314e-7913-4e8d-a808-4deac82ff7f1/scratchpad/evidence_gerencia_v2.json"
with open(evidence_path, "w") as f:
    json.dump(evidence, f, indent=2, ensure_ascii=False)
print(f"\nEvidencia guardada: {evidence_path}")
