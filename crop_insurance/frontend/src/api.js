import axios from 'axios';

// No external API URL needed — frontend is served from the same server as the API
const api = axios.create({
  baseURL: '',
});

export default api;
