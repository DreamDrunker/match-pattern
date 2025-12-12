use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen::prelude::*;

use crate::types::Pattern;

pub fn check_pattern(data: &JsValue, pattern: &Pattern) -> Result<bool, JsValue> {
    match pattern {
        Pattern::Value(pattern_value) => check_value_equal(data, pattern_value),
        Pattern::Object(pattern_obj) => check_object_match(data, pattern_obj),
        Pattern::Function(func) => check_function_match(data, func),
        Pattern::Wildcard => Ok(true),
    }
}

pub fn check_value_equal(a: &JsValue, b: &JsValue) -> Result<bool, JsValue> {
    if a.is_null() && b.is_null() {
        return Ok(true);
    }
    if a.is_undefined() && b.is_undefined() {
        return Ok(true);
    }
    if let (Some(num_a), Some(num_b)) = (a.as_f64(), b.as_f64()) {
        return Ok((num_a - num_b).abs() < f64::EPSILON);
    }
    if let (Some(str_a), Some(str_b)) = (a.as_string(), b.as_string()) {
        return Ok(str_a == str_b);
    }
    if let (Some(bool_a), Some(bool_b)) = (a.as_bool(), b.as_bool()) {
        return Ok(bool_a == bool_b);
    }
    if Array::is_array(a) && Array::is_array(b) {
        return check_array_equal(a, b);
    }
    if a.is_object() && b.is_object() {
        return check_object_equal(a, b);
    }
    Ok(false)
}

pub fn check_array_equal(a: &JsValue, b: &JsValue) -> Result<bool, JsValue> {
    let arr_a = Array::from(a);
    let arr_b = Array::from(b);

    if arr_a.length() != arr_b.length() {
        return Ok(false);
    }

    arr_a
        .iter()
        .zip(arr_b.iter())
        .find_map(|(a, b)| match check_value_equal(&a, &b) {
            Ok(true) => None,
            Ok(false) => Some(Ok(false)),
            Err(e) => Some(Err(e)),
        })
        .unwrap_or(Ok(true))
}

pub fn check_object_equal(a: &JsValue, b: &JsValue) -> Result<bool, JsValue> {
    let obj_a = Object::from(a.clone());
    let obj_b = Object::from(b.clone());

    let keys_a = Object::keys(&obj_a);
    let keys_b = Object::keys(&obj_b);

    if keys_a.length() != keys_b.length() {
        return Ok(false);
    }

    keys_a
        .iter()
        .find_map(|key| {
            match Reflect::has(&obj_b, &key) {
                Ok(false) => return Some(Ok(false)),
                Err(e) => return Some(Err(e)),
                Ok(true) => {}
            }
            let val_a = match Reflect::get(&obj_a, &key) {
                Ok(v) => v,
                Err(e) => return Some(Err(e)),
            };
            let val_b = match Reflect::get(&obj_b, &key) {
                Ok(v) => v,
                Err(e) => return Some(Err(e)),
            };
            match check_value_equal(&val_a, &val_b) {
                Ok(true) => None,
                Ok(false) => Some(Ok(false)),
                Err(e) => Some(Err(e)),
            }
        })
        .unwrap_or(Ok(true))
}

pub fn check_object_match(data: &JsValue, pattern: &JsValue) -> Result<bool, JsValue> {
    if !pattern.is_object() {
        return check_value_equal(data, pattern);
    }
    if !data.is_object() {
        return Ok(false);
    }
    let data_obj = Object::from(data.clone());
    let pattern_obj = Object::from(pattern.clone());
    let keys = Object::keys(&pattern_obj);
    keys.iter()
        .find_map(|key| {
            match Reflect::has(&data_obj, &key) {
                Ok(false) => return Some(Ok(false)),
                Err(e) => return Some(Err(e)),
                Ok(true) => {}
            }
            let data_value = match Reflect::get(&data_obj, &key) {
                Ok(v) => v,
                Err(e) => return Some(Err(e)),
            };
            let pattern_value = match Reflect::get(&pattern_obj, &key) {
                Ok(v) => v,
                Err(e) => return Some(Err(e)),
            };
            match check_object_match(&data_value, &pattern_value) {
                Ok(true) => None,
                Ok(false) => Some(Ok(false)),
                Err(e) => Some(Err(e)),
            }
        })
        .unwrap_or(Ok(true))
}

fn check_function_match(data: &JsValue, func: &JsValue) -> Result<bool, JsValue> {
    let function = Function::from(func.clone());
    let result = function.call1(&JsValue::NULL, data)?;

    Ok(result.is_truthy())
}
