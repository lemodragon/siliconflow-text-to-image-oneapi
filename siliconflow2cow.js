//本项目授权api_key，防止被恶意调用
const API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

//硅基流动Token列表，每次请求都会随机从列表里取一个Token
const SILICONFLOW_TOKEN_LIST = ["sk-xxxxxx","sk-xxxxx","sk-xxxxx","sk-xxxxx"];
// 是否开启提示词翻译、优化功能
const SILICONFLOW_IS_TRANSLATE = true;
// 提示词翻译、优化模型
const SILICONFLOW_TRANSLATE_MODEL = "THUDM/glm-4-9b-chat";

// 模型映射，设置客户端可用的模型。
const CUSTOMER_MODEL_MAP = {
    "flux.s": "black-forest-labs/FLUX.1-schnell",
    "flux.d": "black-forest-labs/FLUX.1-dev",
    "sd3": "stabilityai/stable-diffusion-3-medium",
    "sd1": "stabilityai/stable-diffusion-xl-base-1.0",
    "sd2": "stabilityai/stable-diffusion-2-1",
    "sdt": "stabilityai/sd-turbo",
    "sdxl": "stabilityai/sdxl-turbo",
    "sdxll": "ByteDance/SDXL-Lightning",
    "pm": "TencentARC/PhotoMaker"
};

const RATIO_MAP = {
    "1:1": "1024x1024",
    "1:2": "1024x2048",
    "2:1": "2048x1024",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "4:3": "1536x1152",
    "3:4": "1152x1536",
    "16:9": "2048x1152",
    "9:16": "1152x2048"
};

async function handleRequest(request) {
    try {
        if (request.method === "OPTIONS") {
            return new Response("", {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    "Access-Control-Allow-Headers": '*'
                }
            });
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== API_KEY) {
            return new Response("Unauthorized", { status: 401 });
        }

        if (request.url.endsWith("/v1/models")) {
            const arrs = [];
            Object.keys(CUSTOMER_MODEL_MAP).map(element => arrs.push({ id: element, object: "model" }))
            const response = {
                data: arrs,
                success: true
            };
            return new Response(JSON.stringify(response), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*'
                }
            });
        }

        if (request.method !== "POST") {
            return new Response("Only POST requests are allowed", {
                status: 405,
            });
        }

        if (!request.url.endsWith("/v1/chat/completions")) {
            return new Response("Not Found", {
                status: 404,
            });
        }

        const data = await request.json();
        const messages = data.messages || [];
        const userMessage = messages.find((msg) => msg.role === "user");

        if (!userMessage) {
            return new Response(JSON.stringify({ error: "未找到用户消息" }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*'
                }
            });
        }

        console.log("User message:", userMessage);

        let modelKey = data.model || userMessage.model || extractModelKey(userMessage.content);
        console.log("Extracted model key:", modelKey);

        let size = userMessage.size || extractImageSize(userMessage.content);
        console.log("Image size:", size);

        const cleanedPrompt = cleanPromptString(userMessage.content);
        const model = CUSTOMER_MODEL_MAP[modelKey] || modelKey || "black-forest-labs/FLUX.1-schnell";
        console.log("Selected model:", model);

        const prompt = removeModelAndSizeFromPrompt(cleanedPrompt);
        const imageUrl = extractImageUrl(prompt);
        const originalPrompt = removeImageUrls(prompt);
        let translatedPrompt;
        try {
            translatedPrompt = SILICONFLOW_IS_TRANSLATE ? await getPrompt(originalPrompt) : originalPrompt;
        } catch (error) {
            console.error("Translation failed, using original prompt:", error);
            translatedPrompt = originalPrompt;
        }

        console.log("Translated prompt:", translatedPrompt);

        let url;
        if (!imageUrl) {
            url = await generateImageByText(translatedPrompt, model, size);
        } else {
            const base64 = await convertImageToBase64(imageUrl);
            url = await generateImageByImg(translatedPrompt, base64, model, size);
        }

        console.log("Generated image URL:", url);

        if (!url) {
            url = "https://pic.netbian.com/uploads/allimg/240808/192001-17231160015724.jpg";
        }

        const stream = data.stream || false;
        if (stream) {
            return handleStreamResponse(originalPrompt, translatedPrompt, size, model, url);
        } else {
            return handleNonStreamResponse(originalPrompt, translatedPrompt, size, model, url);
        }

    } catch (error) {
        console.error("处理请求时出错:", error);
        return new Response(JSON.stringify({ error: `处理请求失败: ${error.message}` }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }
}

async function generateImageByText(translatedPrompt, model, imageSize) {
    const apiUrl = "https://api.siliconflow.cn/v1/image/generations";

    const jsonBody = {
        model: model,
        prompt: translatedPrompt,
        image_size: imageSize,
        seed: Math.floor(Math.random() * 1000000)
    };

    if (model.includes("FLUX")) {
        jsonBody.num_inference_steps = 50;
    } else {
        jsonBody.num_inference_steps = 50;
        jsonBody.guidance_scale = 7.5;

        if (["stabilityai/sd-turbo", "stabilityai/sdxl-turbo"].includes(model)) {
            jsonBody.num_inference_steps = 6;
            jsonBody.guidance_scale = 1;
        } else if (model === "ByteDance/SDXL-Lightning") {
            jsonBody.num_inference_steps = 4;
            jsonBody.guidance_scale = 1;
        }
    }

    return await getImageUrl(apiUrl, jsonBody);
}

async function generateImageByImg(translatedPrompt, base64, model, imageSize) {
    const apiUrl = "https://api.siliconflow.cn/v1/image/generations";

    const jsonBody = {
        model: model,
        prompt: translatedPrompt,
        image: base64,
        image_size: imageSize,
        num_inference_steps: 50,
        guidance_scale: 7.5,
        seed: Math.floor(Math.random() * 1000000)
    };

    if (model === "ByteDance/SDXL-Lightning") {
        jsonBody.num_inference_steps = 4;
        jsonBody.guidance_scale = 1;
    } else if (model === "TencentARC/PhotoMaker") {
        jsonBody.style_name = "Photographic (Default)";
        jsonBody.guidance_scale = 5;
        jsonBody.style_strength_ratio = 20;
    }

    return await getImageUrl(apiUrl, jsonBody);
}

function handleStreamResponse(originalPrompt, translatedPrompt, size, model, imageUrl) {
    const uniqueId = `chatcmpl-${Date.now()}`;
    const createdTimestamp = Math.floor(Date.now() / 1000);
    const systemFingerprint = "fp_" + Math.random().toString(36).substr(2, 9);
    const content = `🎨 原始提示词：${originalPrompt}\n` +
        `🌐 翻译后的提示词：${translatedPrompt}\n` +
        `📐 图像规格：${size}\n` +
        `🌟 图像生成成功！\n` +
        `以下是结果：\n\n` +
        `![生成的图像](${imageUrl})`;

    const responsePayload = {
        id: uniqueId,
        object: "chat.completion.chunk",
        created: createdTimestamp,
        model: model,
        system_fingerprint: systemFingerprint,
        choices: [
            {
                index: 0,
                delta: {
                    content: content,
                },
                finish_reason: "stop",
            },
        ],
    };

    const dataString = JSON.stringify(responsePayload);

    return new Response(`data: ${dataString}\n\n`, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            'Access-Control-Allow-Origin': '*',
            "Access-Control-Allow-Headers": '*',
        },
    });
}

function handleNonStreamResponse(originalPrompt, translatedPrompt, size, model, imageUrl) {
    const uniqueId = `chatcmpl-${Date.now()}`;
    const createdTimestamp = Math.floor(Date.now() / 1000);
    const systemFingerprint = "fp_" + Math.random().toString(36).substr(2, 9);
    const content = `🎨 原始提示词：${originalPrompt}\n` +
        `🌐 翻译后的提示词：${translatedPrompt}\n` +
        `📐 图像规格：${size}\n` +
        `🌟 图像生成成功！\n` +
        `以下是结果：\n\n` +
        `![生成的图像](${imageUrl})`;

    const response = {
        id: uniqueId,
        object: "chat.completion",
        created: createdTimestamp,
        model: model,
        system_fingerprint: systemFingerprint,
        choices: [{
            index: 0,
            message: {
                role: "assistant",
                content: content
            },
            finish_reason: "stop"
        }],
        usage: {
            prompt_tokens: translatedPrompt.length,
            completion_tokens: content.length,
            total_tokens: translatedPrompt.length + content.length
        }
    };

    const dataString = JSON.stringify(response);

    return new Response(dataString, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
        }
    });
}

async function getPrompt(prompt) {
    const requestBodyJson = {
        model: SILICONFLOW_TRANSLATE_MODEL,
        messages: [
            {
                role: "system",
                content: `作为 Stable Diffusion Prompt 提示词专家，您将从关键词中创建提示，通常来自 Danbooru 等数据库。

        提示通常描述图像，使用常见词汇，按重要性排列，并用逗号分隔。避免使用"-"或"."，但可以接受空格和自然语言。避免词汇重复。

        为了强调关键词，请将其放在括号中以增加其权重。例如，"(flowers)"将'flowers'的权重增加1.1倍，而"(((flowers)))"将其增加1.331倍。使用"(flowers:1.5)"将'flowers'的权重增加1.5倍。只为重要的标签增加权重。

        提示包括三个部分：**前缀**（质量标签+风格词+效果器）+ **主题**（图像的主要焦点）+ **场景**（背景、环境）。

        *   前缀影响图像质量。像"masterpiece"、"best quality"、"4k"这样的标签可以提高图像的细节。像"illustration"、"lensflare"这样的风格词定义图像的风格。像"bestlighting"、"lensflare"、"depthoffield"这样的效果器会影响光照和深度。

        *   主题是图像的主要焦点，如角色或场景。对主题进行详细描述可以确保图像丰富而详细。增加主题的权重以增强其清晰度。对于角色，描述面部、头发、身体、服装、姿势等特征。

          *   场景描述环境。没有场景，图像的背景是平淡的，主题显得过大。某些主题本身包含场景（例如建筑物、风景）。像"花草草地"、"阳光"、"河流"这样的环境词可以丰富场景。你的任务是设计图像生成的提示。请按照以下步骤进行操作：

            1.  我会发送给您一个图像场景。需要你生成详细的图像描述
            2.  图像描述必须是英文，输出为Positive Prompt。
      
              示例：
      
              我发送：二战时期的护士。
              您回复只回复：
              A WWII-era nurse in a German uniform, holding a wine bottle and stethoscope, sitting at a table in white attire, with a table in the background, masterpiece, best quality, 4k, illustration style, best lighting, depth of field, detailed character, detailed environment.`
            },
            {
                role: "user",
                content: prompt
            }
        ],
        stream: false,
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        frequency_penalty: 0.5,
        n: 1
    };

    const apiUrl = "https://api.siliconflow.cn/v1/chat/completions";
    const response = await postRequest(apiUrl, requestBodyJson);
    const jsonResponse = await response.json();
    if (jsonResponse.code && jsonResponse.message) {
        console.error("API Error:", jsonResponse);
        throw new Error(`API Error: ${jsonResponse.message}`);
    }
    if (!jsonResponse.choices || !jsonResponse.choices[0] || !jsonResponse.choices[0].message) {
        console.error("Unexpected response structure:", jsonResponse);
        throw new Error("Unexpected response structure from translation API");
    }
    const res = jsonResponse.choices[0].message.content;
    return res;
}

async function getImageUrl(apiUrl, jsonBody){
    const response = await postRequest(apiUrl, jsonBody);
    const jsonResponse = await response.json();
    console.log("API Response:", jsonResponse);  // 添加日志
    if (jsonResponse.code && jsonResponse.message) {
        console.error("API Error:", jsonResponse);
        throw new Error(`API Error: ${jsonResponse.message}`);
    }
    if (!jsonResponse.images || !jsonResponse.images[0] || !jsonResponse.images[0].url) {
        console.error("Unexpected response structure:", jsonResponse);
        throw new Error("Unexpected response structure from image generation API");
    }
    return jsonResponse.images[0].url;
}

async function postRequest(apiUrl, jsonBody) {
    const token = SILICONFLOW_TOKEN_LIST[Math.floor(Math.random() * SILICONFLOW_TOKEN_LIST.length)];
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonBody)
    });

    return response;
}

function extractModelKey(prompt) {
    const match = prompt.match(/-m\s+(\S+)/);
    if (match) {
        const extractedKey = match[1].trim().toLowerCase();
        const foundKey = Object.entries(CUSTOMER_MODEL_MAP).find(([key, value]) => 
            key.toLowerCase() === extractedKey || value.toLowerCase() === extractedKey
        );
        return foundKey ? foundKey[0] : extractedKey;
    }
    return "";
}

function extractImageSize(prompt) {
    const match = prompt.match(/---(\d+:\d+)/);
    if (match) {
        const ratio = match[1].trim();
        const size = RATIO_MAP[ratio] || "1024x1024";
        console.log(`Extracted ratio: ${ratio}, Mapped size: ${size}`);
        return size;
    }
    console.log("No size specified in prompt, using default: 1024x1024");
    return "1024x1024";
}

function cleanPromptString(prompt) {
    return prompt.trim();
}

function removeModelAndSizeFromPrompt(prompt) {
    return prompt.replace(/-m\s+\S+/, "").replace(/---\d+:\d+/, "").trim();
}

function extractImageUrl(text) {
    const regex = /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|bmp|webp|svg))/i;
    const match = text.match(regex);
    return match ? match[0] : null;
}

function base64Encode(arrayBuffer) {
    const base64 = [];
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        base64.push(String.fromCharCode(bytes[i]));
    }
    return btoa(base64.join(''));
}

async function convertImageToBase64(imageUrl) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error('Failed to download image');
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Image = base64Encode(arrayBuffer);
    return `data:image/webp;base64,${base64Image}`;
}

function removeImageUrls(text) {
    return text.replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|bmp|webp|svg)/gi, "");
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
