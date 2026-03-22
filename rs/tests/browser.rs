use js_sys::{Array, Object};
use match_pattern_rs::{ObjectWithProps, compile_match_plan, match_pattern};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn browser_compile_match_plan_reports_shadowed_branch() {
    let program = Object::new().with_prop(
        "branches",
        Array::from_iter([
            Object::new()
                .with_prop("actionIndex", 0)
                .with_prop("predicate", Object::new().with_prop("kind", "isNumber")),
            Object::new()
                .with_prop("actionIndex", 1)
                .with_prop(
                    "predicate",
                    Object::new()
                        .with_prop("kind", "eq")
                        .with_prop("value", JsValue::from_f64(1.0)),
                ),
        ]),
    );

    let plan =
        serde_wasm_bindgen::from_value::<serde_json::Value>(compile_match_plan(program.into()).unwrap())
            .unwrap();

    assert_eq!(plan["version"], 1);
    assert_eq!(plan["branches"].as_array().unwrap().len(), 2);
    assert!(plan["diagnostics"].as_array().unwrap().iter().any(|diagnostic| {
        diagnostic["code"] == "unreachable_branch" && diagnostic["branchIndex"] == 1
    }));
}

#[wasm_bindgen_test]
fn browser_match_pattern_keeps_branch_order() {
    let patterns = Array::from_iter([
        Object::new()
            .with_prop("type", "Value")
            .with_prop("value", JsValue::from_str("browser")),
        Object::new().with_prop("type", "Wildcard"),
    ]);

    let exact_match = match_pattern(JsValue::from_str("browser"), patterns.clone().into())
        .unwrap()
        .as_f64()
        .unwrap();
    let fallback_match = match_pattern(JsValue::from_str("other"), patterns.into())
        .unwrap()
        .as_f64()
        .unwrap();

    assert_eq!(exact_match, 0.0);
    assert_eq!(fallback_match, 1.0);
}
