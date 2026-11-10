#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const KEYRING_SERVICE: &str = "com.xflux.socialai";

#[tauri::command]
fn secure_store_credential(account: String, value: String) -> Result<(), String> {
    if account.trim().is_empty() || account.len() > 200 || value.len() > 64_000 {
        return Err("Dados da credencial inválidos.".into());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account)
        .map_err(|e| format!("Não foi possível acessar o cofre do sistema: {e}"))?;
    entry.set_password(&value)
        .map_err(|e| format!("Não foi possível salvar a credencial no cofre do sistema: {e}"))
}

#[tauri::command]
fn secure_read_credential(account: String) -> Result<Option<String>, String> {
    if account.trim().is_empty() || account.len() > 200 {
        return Err("Identificador da credencial inválido.".into());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account)
        .map_err(|e| format!("Não foi possível acessar o cofre do sistema: {e}"))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Não foi possível ler a credencial do cofre do sistema: {e}")),
    }
}

#[tauri::command]
fn secure_delete_credential(account: String) -> Result<(), String> {
    if account.trim().is_empty() || account.len() > 200 {
        return Err("Identificador da credencial inválido.".into());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account)
        .map_err(|e| format!("Não foi possível acessar o cofre do sistema: {e}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Não foi possível remover a credencial do cofre do sistema: {e}")),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![
            secure_store_credential,
            secure_read_credential,
            secure_delete_credential
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o XFLUX Social AI");
}
