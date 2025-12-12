use js_sys::{Object, Reflect};
use wasm_bindgen::prelude::*;

pub trait ObjectWithProps: Sized {
    fn with_prop(self, key: impl AsRef<str>, value: impl Into<JsValue>) -> Self;
}

impl ObjectWithProps for Object {
    fn with_prop(self, key: impl AsRef<str>, value: impl Into<JsValue>) -> Self {
        let _ = Reflect::set(&self, &JsValue::from_str(key.as_ref()), &value.into());
        self
    }
}

#[wasm_bindgen]
pub fn log(msg: &str) {
    web_sys::console::log_1(&JsValue::from_str(msg));
}
