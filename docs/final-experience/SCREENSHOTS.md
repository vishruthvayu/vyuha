# Browser evidence

These are captures of the real production client running against isolated authenticated QA servers. They are not mockups. Full raw screenshot sequences remain next to their JSON receipts.

| View | Before | After |
|---|---|---|
| Daylight optics | [Base](baseline/urban-DAY-TV.png) | [Rendering milestone](after/urban-DAY-TV.png) |
| Thermal close-up diagnostic | [Base](baseline/closeup-0-THERMAL.png) | [Rendering milestone](after/closeup-0-THERMAL.png) |
| Daylight close-up diagnostic | [Base](baseline/closeup-0-DAY-TV.png) | [Rendering milestone](after/closeup-0-DAY-TV.png) |
| Desktop classification | [Base live raid](baseline/urban-02-classify.png) | [Final controls](after/layout/1440-classify.png) |
| Desktop response | [Base live raid](baseline/urban-03-respond.png) | [Final controls](after/layout/1440-respond.png) |

Base live raids and final scripted geometry checks have different scenario contents. Compare layout positions using the geometry JSON, and rendering details using the fixed diagnostic captures.

Final controls: [360px phone](after/layout/360-classify.png), [390px phone](after/layout/390-classify.png), [428px phone](after/layout/428-classify.png), [768px tablet](after/layout/768-classify.png), [1024px](after/layout/1024-classify.png), [1280×720 laptop](after/layout/1280-classify.png), [1440px](after/layout/1440-classify.png), [1920px](after/layout/1920-classify.png).

Finite resources: [phone busy jammer](after/resources/390-busy.png), [desktop reload](after/resources/1440-reload.png), [desktop delayed outcome](after/resources/1440-finished.png). The tests deliberately submit controlled QA responses to exercise resource states; they are not model trainee decisions.

Two natural-completion raid reviews: [urban](after/urban-05-verified-review.png), [rural](after/rural-05-verified-review.png).
