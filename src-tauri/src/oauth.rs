//! Suporte nativo ao login OAuth de apps desktop: receptor local, navegador e HTTPS restrito.
use serde::Serialize;
use serde_json::Value;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
pub struct OauthState(Mutex<Option<TcpListener>>);

const BROWSER_HOSTS: &[&str] = &["accounts.google.com", "console.cloud.google.com"];
const API_HOSTS: &[&str] = &["oauth2.googleapis.com", "www.googleapis.com"];

fn host_allowed(raw: &str, allowed: &[&str]) -> Result<url::Url, String> {
    let u = url::Url::parse(raw).map_err(|_| "Endereço inválido.".to_string())?;
    if u.scheme() != "https" || !u.username().is_empty() || u.password().is_some() {
        return Err("Endereço não permitido.".into());
    }
    match u.host_str() {
        Some(h) if allowed.contains(&h) => Ok(u),
        _ => Err("Endereço não permitido.".into()),
    }
}

#[derive(Serialize)]
pub struct LoopbackInfo { port: u16 }

#[tauri::command]
pub fn oauth_loopback_start(state: State<OauthState>) -> Result<LoopbackInfo, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Não foi possível abrir a porta local: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    *state.0.lock().map_err(|_| "Estado interno bloqueado.".to_string())? = Some(listener);
    Ok(LoopbackInfo { port })
}

#[derive(Serialize)]
pub struct CallbackResult { code: Option<String>, state: Option<String>, error: Option<String> }

#[tauri::command]
pub async fn oauth_loopback_wait(state: State<'_, OauthState>, timeout_secs: u64) -> Result<CallbackResult, String> {
    let listener = {
        let mut guard = state.0.lock().map_err(|_| "Estado interno bloqueado.".to_string())?;
        guard.take()
    }.ok_or_else(|| "Nenhum login em andamento.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || wait_for_callback(listener, timeout_secs.min(600)))
        .await.map_err(|e| e.to_string())?
}

fn wait_for_callback(listener: TcpListener, timeout_secs: u64) -> Result<CallbackResult, String> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                if let Some(result) = handle_connection(&mut stream) { return Ok(result); }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline { return Err("timeout".into()); }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(e) => return Err(format!("Falha ao receber o retorno: {e}")),
        }
    }
}

fn handle_connection(stream: &mut TcpStream) -> Option<CallbackResult> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).ok()?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let line = req.lines().next()?;
    let mut parts = line.split_whitespace();
    let method = parts.next()?;
    let target = parts.next()?;
    if method != "GET" { respond(stream, 405, "Método não permitido."); return None; }
    let parsed = url::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if parsed.path() != "/callback" { respond(stream, 404, "Não encontrado."); return None; }
    let mut r = CallbackResult { code: None, state: None, error: None };
    for (k, v) in parsed.query_pairs() {
        match k.as_ref() {
            "code" => r.code = Some(v.into_owned()),
            "state" => r.state = Some(v.into_owned()),
            "error" => r.error = Some(v.into_owned()),
            _ => {}
        }
    }
    if r.code.is_none() && r.error.is_none() { respond(stream, 400, "Retorno inválido."); return None; }
    respond(stream, 200, "XFLUX: autorização recebida. Você já pode fechar esta janela e voltar ao aplicativo.");
    Some(r)
}

fn respond(stream: &mut TcpStream, status: u16, text: &str) {
    let reason = match status { 200 => "OK", 400 => "Bad Request", 404 => "Not Found", _ => "Method Not Allowed" };
    let body = format!("<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>XFLUX</title><body style=\"font-family:sans-serif;text-align:center;margin-top:3rem\"><h2>{text}</h2></body></html>");
    let resp = format!("HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{body}", body.len());
    let _ = stream.write_all(resp.as_bytes());
}

#[tauri::command]
pub fn oauth_open_browser(app: AppHandle, url: String) -> Result<(), String> {
    let u = host_allowed(&url, BROWSER_HOSTS)?;
    app.opener().open_url(u.as_str(), None::<&str>).map_err(|e| format!("Não foi possível abrir o navegador: {e}"))
}

#[derive(Serialize)]
pub struct HttpResult { status: u16, body: Value }

#[tauri::command]
pub async fn oauth_http_request(
    method: String, url: String, form: Option<Vec<(String, String)>>, bearer: Option<String>,
) -> Result<HttpResult, String> {
    let u = host_allowed(&url, API_HOSTS)?;
    tauri::async_runtime::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(20)).build();
        let mut req = match method.as_str() {
            "GET" => agent.get(u.as_str()),
            "POST" => agent.post(u.as_str()),
            _ => return Err("Método não permitido.".to_string()),
        };
        if let Some(t) = &bearer { req = req.set("Authorization", &format!("Bearer {t}")); }
        let result = match (method.as_str(), &form) {
            ("POST", Some(f)) => {
                let pairs: Vec<(&str, &str)> = f.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
                req.send_form(&pairs)
            }
            ("POST", None) => req.send_string(""),
            _ => req.call(),
        };
        let (status, text) = match result {
            Ok(r) => { let s = r.status(); (s, r.into_string().unwrap_or_default()) }
            Err(ureq::Error::Status(code, r)) => (code, r.into_string().unwrap_or_default()),
            Err(e) => return Err(format!("Falha de rede: {e}")),
        };
        let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
        Ok(HttpResult { status, body })
    }).await.map_err(|e| e.to_string())?
}
