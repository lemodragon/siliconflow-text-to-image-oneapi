## SiliconFlow Text-to-Image API Wrapper

### 项目概述

SiliconFlow Text-to-Image API Wrapper 是一个运行在 Cloudflare Workers 上的服务，它包装了多个文本生成图像的 API，提供了一个统一的接口来访问多种图像生成模型。这个项目允许用户通过简单的 API 调用来生成高质量的图像，支持多种模型选择和图像大小定制。

### 功能特性

- 支持多种图像生成模型，包括 FLUX.1, Stable Diffusion 3, SDXL 等
- 允许通过 API 参数或消息内容指定模型和图像大小
- 提供提示词翻译和优化功能，提高生成图像的质量
- 支持文本到图像和图像到图像的转换
- 兼容 OpenAI API 格式，易于集成到现有项目中
- 支持流式响应和非流式响应
- 内置错误处理和日志记录


### 使用说明

#### 基本用法

发送 POST 请求到 `/v1/chat/completions` 端点，格式如下：

```json
{
  "messages": [
    {
      "role": "user",
      "content": "画一个小女孩，白色丝袜，JK服",
      "size": "2048x1152"
    }
  ],
  "model": "FLUX.1"
}
```

#### 指定模型和尺寸

你可以通过以下两种方式指定模型和图像尺寸：

1. 在请求体中直接指定：
   ```json
   {
     "messages": [{ "role": "user", "content": "画一个小女孩" }],
     "model": "stable-diffusion-3-medium",
     "size": "1024x1024"
   }
   ```

2. 在 content 字段中使用特殊语法：
   ```json
   {
     "messages": [
       {
         "role": "user",
         "content": "画一个小女孩 -m sd3 ---16:9"
       }
     ]
   }
   ```

### 配置选项

在代码中，你可以配置以下选项：

- `API_KEY`: 用于授权 API 访问的密钥
- `SILICONFLOW_TOKEN_LIST`: SiliconFlow API 的令牌列表
- `SILICONFLOW_IS_TRANSLATE`: 是否启用提示词翻译功能
- `SILICONFLOW_TRANSLATE_MODEL`: 用于翻译的模型
- `CUSTOMER_MODEL_MAP`: 客户端可用的模型映射

### API 参考

#### 端点

- `POST /v1/chat/completions`: 主要的图像生成端点
- `GET /v1/models`: 获取可用模型列表

#### 请求参数

- `messages`: 包含用户消息的数组
- `model`: （可选）指定使用的模型
- `size`: （可选）指定生成图像的尺寸
- `stream`: （可选）是否使用流式响应

#### 响应格式

响应将包含生成的图像 URL 和其他相关信息，格式类似于 OpenAI API 的响应。


## siliconflow2cow-flux-dall-e-3.js文件部署

### 环境变量如下
- API_KEY:
```
sk-xxxx,sk-xxxx,skk-xxxx
```
- DEEPSEEK_API_URL:	
```
https://api.siliconflow.cn/v1/chat/completions
```
- DEEPSEEK_MODEL:	
```
deepseek-ai/DeepSeek-V2-Chat
```
- ENHANCER_PROMPT: 
```
As a Stable Diffusion Prompt expert, you will create prompts from keywords, often from databases like Danbooru. Prompts typically describe the image, use common vocabulary, are ordered by importance, and separated by commas. Avoid using "-" or ".", but spaces and natural language are acceptable. Avoid word repetition. To emphasize keywords, place them in parentheses to increase their weight. For example, "(flowers)" increases 'flowers' weight by 1.1x, while "(((flowers)))" increases it by 1.331x. Use "(flowers:1.5)" to increase 'flowers' weight by 1.5x. Only increase weights for important tags. Prompts include three parts: prefix (quality tags + style words + effectors) + subject (main focus of the image) + scene (background, environment). The prefix affects image quality. Tags like "masterpiece", "best quality" increase image detail. Style words like "illustration", "lensflare" define the image style. Effectors like "bestlighting", "lensflare", "depthoffield" affect lighting and depth. The subject is the main focus, like characters or scenes. Detailed subject description ensures rich, detailed images. Increase subject weight for clarity. For characters, describe facial, hair, body, clothing, pose features. The scene describes the environment. Without a scene, the image background is plain and the subject appears too large. Some subjects inherently include scenes (e.g., buildings, landscapes). Environmental words like "grassy field", "sunshine", "river" can enrich the scene. Your task is to design image generation prompts. Please follow these steps: 1. I will send you an image scene. You need to generate a detailed image description. 2. The image description must be in English, output as a Positive Prompt.
```
- FLUX_API_URL:	
```
https://api.siliconflow.cn/v1/black-forest-labs/FLUX.1-schnell/text-to-image
```
- NUM_INFERENCE_STEPS:	 
```
28
```
- VALID_API_KEYS:
```
XXXXXXX
```
