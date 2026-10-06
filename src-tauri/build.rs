fn main() {
    println!("cargo:rerun-if-changed=native/weasel_preview/wss_preview.cpp");
    println!("cargo:rerun-if-changed=native/weasel_preview/wss_preview.h");
    if std::env::var("CARGO_CFG_WINDOWS").is_ok() {
        cc::Build::new()
            .cpp(true)
            .flag_if_supported("/std:c++17")
            .file("native/weasel_preview/wss_preview.cpp")
            .include("native/weasel_preview")
            .compile("wss_preview");
        println!("cargo:rustc-link-lib=d2d1");
        println!("cargo:rustc-link-lib=dwrite");
        println!("cargo:rustc-link-lib=gdi32");
        println!("cargo:rustc-link-lib=user32");
        println!("cargo:rustc-link-lib=ole32");
    }
    tauri_build::build()
}
