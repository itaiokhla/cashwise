import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import {getCookie} from "cookies-next";


//get token from localstorage
    const token=getCookie("accessToken");
    
    // Create the Axios client
    const client = axios.create({
        baseURL: process.env.NEXT_PUBLIC_BASE_URL,
        headers: {
            Authorization: token ? `Bearer ${token}` : undefined 
        }
    });

    // Set Content-Type header dynamically
    client.interceptors.request.use(

        (config: InternalAxiosRequestConfig) => {
            if (config.method === 'post' || config.method === 'put') {
                if (config.data instanceof FormData) {
                    config.headers['Content-Type'] = 'multipart/form-data';

                } else {
                    config.headers['Content-Type'] = 'application/json';
                }
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );



// Export the function as default
export default client;