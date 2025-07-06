const axios = require('axios');

class ChatGPTService {
  constructor(apiKey, model = 'gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://api.openai.com/v1/chat/completions';
  }

  async generateContent(prompt, maxTokens = 150, temperature = 0.7) {
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant for a restaurant management system. Provide concise, engaging, and accurate responses.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('ChatGPT API Error:', error.response?.data || error.message);
      throw new Error('Failed to generate content with ChatGPT');
    }
  }

  async generateMenuDescription(productName, cuisine, ingredients = []) {
    const prompt = `Generate an appetizing description for a restaurant menu item: "${productName}" from ${cuisine} cuisine. Ingredients: ${ingredients.join(', ')}. Keep it under 100 words and make it sound delicious.`;
    return await this.generateContent(prompt);
  }

  async generatePromotionalContent(restaurantName, cuisine, specialOffer = '') {
    const prompt = `Create a promotional message for ${restaurantName} (${cuisine} cuisine). ${specialOffer ? `Special offer: ${specialOffer}` : ''} Make it engaging and encourage customers to order. Keep it under 80 words.`;
    return await this.generateContent(prompt);
  }

  async analyzeCustomerReview(reviewText) {
    const prompt = `Analyze this customer review for a restaurant: "${reviewText}". Provide a brief analysis including sentiment (positive/negative/neutral), key points, and suggestions for improvement if needed.`;
    return await this.generateContent(prompt, 200);
  }

  async generateCustomerSupportResponse(customerQuery, restaurantContext = '') {
    const prompt = `A customer has asked: "${customerQuery}" about a restaurant. ${restaurantContext ? `Restaurant context: ${restaurantContext}` : ''} Provide a helpful, professional response that addresses their concern.`;
    return await this.generateContent(prompt, 200);
  }
}

module.exports = ChatGPTService; 