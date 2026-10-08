const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/v1/influencers/search', {
      params: { niche: ['beauty'], platform: 'instagram' }
    });
    console.log('Result total:', res.data.meta.total);
    console.log('Data length:', res.data.data.length);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
