import os
import time
import requests

# Replace with your actual pre-signed URLs and storage option
SIGNED_PRODUCT_URL = 'https://your-storage-bucket-name.blob.core.windows.net:443/images/asdf-12345?lots=of&query=params...'  # Input product URL for Photoshop 
SIGNED_GET_POST_URL = 'https://your-storage-bucket-name.blob.core.windows.net:443/images/asdf-12345?lots=of&query=params...'  # Output product URL for Photoshop and Lightroom
SIGNED_STYLE_REF_URL = 'https://your-storage-bucket-name.blob.core.windows.net:443/images/asdf-12345?lots=of&query=params...'  # Style reference image URL for Firefly
STORAGE = 'azure'  # e.g., 'external', 'azure'

def main():
    access_token = retrieve_access_token()

    # Step 1: Remove Background
    remove_bg_response = remove_background(access_token)
    remove_bg_job_id = extract_job_id(remove_bg_response)
    check_photoshop_job_status(remove_bg_job_id, access_token)

    # Step 2: Generate Object Composite
    generate_object_composite_response = generate_object_composite(access_token)
    generate_object_composite_job_id = generate_object_composite_response['jobId']
    generate_object_composite_output = check_firefly_job_status(generate_object_composite_job_id, access_token)

    # Step 3: Auto Tone
    auto_tone_response = auto_tone(access_token, generate_object_composite_output)
    auto_tone_job_id = extract_job_id(auto_tone_response)
    check_lightroom_job_status(auto_tone_job_id, access_token)

def retrieve_access_token():
    client_id = os.environ['FIREFLY_SERVICES_CLIENT_ID']
    client_secret = os.environ['FIREFLY_SERVICES_CLIENT_SECRET']

    token_url = 'https://ims-na1.adobelogin.com/ims/token/v3'
    payload = {
        'grant_type': 'client_credentials',
        'client_id': client_id,
        'client_secret': client_secret,
        'scope': 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis'
    }

    response = requests.post(token_url, data=payload)
    response.raise_for_status()
    token_data = response.json()
    print("Access Token Retrieved")
    return token_data['access_token']

def remove_background(access_token):
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': os.environ['FIREFLY_SERVICES_CLIENT_ID'],
        'Authorization': f'Bearer {access_token}'
    }

    data = {
        'input': {
            'href': SIGNED_PRODUCT_URL,
            'storage': STORAGE
        },
        'output': {
            'href': SIGNED_GET_POST_URL,
            'storage': STORAGE
        }
    }

    response = requests.post('https://image.adobe.io/sensei/cutout', headers=headers, json=data)
    response.raise_for_status()
    job_response = response.json()
    print("Remove Background Job Submitted:", job_response)
    return job_response

def check_photoshop_job_status(job_id, access_token):
    headers = {
        'x-api-key': os.environ['FIREFLY_SERVICES_CLIENT_ID'],
        'Authorization': f'Bearer {access_token}'
    }

    url = f'https://image.adobe.io/sensei/status/{job_id}'

    status = 'submitted'
    while status not in ['succeeded', 'failed']:
        time.sleep(5)  # Wait for 5 seconds
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        status_response = response.json()
        status = status_response.get('status')
        print(f'Photoshop Job Status: {status}')

    if status == 'succeeded':
        print('Background removal completed successfully!')
    else:
        print('Background removal failed.')

def generate_object_composite(access_token):
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': os.environ['FIREFLY_SERVICES_CLIENT_ID'],
        'Authorization': f'Bearer {access_token}'
    }

    data = {
        'prompt': 'A delicious fiery background',  # Replace with your actual prompt
        'contentClass': 'photo',
        'image': {
            'source': {
                'url': SIGNED_GET_POST_URL
            }
        },
        'placement': {
            'alignment': {
                'horizontal': 'center',
                'vertical': 'center'
            }
        },
        'style': {
            'imageReference': {
                'source': {
                    'url': SIGNED_STYLE_REF_URL
                }
            },
            'strength': 50
        }
    }

    response = requests.post(
        'https://firefly-api.adobe.io/v3/images/generate-object-composite-async',
        headers=headers,
        json=data
    )
    response.raise_for_status()
    job_response = response.json()
    print("Generate Object Composite Job Submitted:", job_response)
    return job_response

def check_firefly_job_status(job_id, access_token):
    client_id = os.environ['FIREFLY_SERVICES_CLIENT_ID']

    headers = {
        'x-api-key': client_id,
        'Authorization': f'Bearer {access_token}'
    }

    url = f'https://firefly-api.adobe.io/v3/status/{job_id}'

    status = 'pending'
    while status not in ['succeeded', 'failed', 'cancelled']:
        time.sleep(5)  # Wait for 5 seconds
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        status_response = response.json()
        status = status_response.get('status')
        print(f'Firefly Job Status: {status}')

    if status == 'succeeded':
        print('Object composite generation completed successfully!')
        image_url = status_response['result']['outputs'][0]['image']['url']
        print(f'You can access the image at: {image_url}')
        return image_url
    else:
        print('Object composite generation failed.')

def auto_tone(access_token, signed_input_url):
    client_id = os.environ['FIREFLY_SERVICES_CLIENT_ID']

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': client_id,
        'Authorization': f'Bearer {access_token}'
    }

    data = {
        'inputs': {
            'href': signed_input_url,
            'storage': 'external'
        },
        'outputs': [{
            'href': SIGNED_GET_POST_URL,
            'storage': STORAGE,
            'type': 'image/jpeg'
        }]
    }

    response = requests.post('https://image.adobe.io/lrService/autoTone', headers=headers, json=data)
    response.raise_for_status()
    job_response = response.json()
    print("Auto Tone Job Submitted:", job_response)
    return job_response

def check_lightroom_job_status(job_id, access_token):
    client_id = os.environ['FIREFLY_SERVICES_CLIENT_ID']

    headers = {
        'x-api-key': client_id,
        'Authorization': f'Bearer {access_token}'
    }

    url = f'https://image.adobe.io/lrService/status/{job_id}'

    status = 'pending'
    while status not in ['succeeded', 'failed']:
        time.sleep(5)  # Wait for 5 seconds
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        status_response = response.json()
        outputs = status_response.get('outputs', [])
        if outputs:
            status = outputs[0].get('status')
        print(f'Lightroom Job Status: {status}')

    if status == 'succeeded':
        print('Auto tone completed successfully!')
        print('You can access the image at your SIGNED_POST_URL.')
    else:
        print('Auto tone failed.')

def extract_job_id(response):
    href = response['_links']['self']['href']
    return href.split('/')[-1]

if __name__ == '__main__':
    main()
