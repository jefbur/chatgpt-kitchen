import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients, theme, dietary } = await req.json();

    const prompt = `Create a recipe using these ingredients: ${ingredients}. 
    Theme: ${theme}. 
    Dietary requirements: ${dietary || 'none'}.
    
    Return a JSON response with this exact structure:
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "servings": 4,
      "prep_time": 15,
      "cook_time": 30,
      "ingredients": ["2 cups flour", "1 cup milk", "2 eggs"],
      "instructions": "Step by step instructions as a single string",
      "notes": "Any additional tips or notes",
      "tags": ["dinner", "easy"]
    }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful chef that creates recipes. Always respond with valid JSON only, no additional text.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const recipeText = data.choices[0].message.content;

    try {
      const recipe = JSON.parse(recipeText);
      return new Response(JSON.stringify(recipe), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse recipe JSON:', parseError);
      return new Response(JSON.stringify({ error: 'Failed to parse recipe' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in generate-recipe function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});