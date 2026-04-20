import csv
import json
import sys

# Usage: python3 convert_products.py data.csv

def convert_csv_to_js(csv_file_path):
    products = []
    
    try:
        with open(csv_file_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Basic mapping - adjust column names as needed
                product = {
                    "id": row.get("id", "").strip(),
                    "name": row.get("name", "").strip(),
                    "category": row.get("category", "other").strip().lower(),
                    # Auto-prefix image path if just filename provided
                    "image": f"./assets/images/products/{row.get('image', '').strip()}",
                    "description": row.get("description", "").strip(),
                    "price": row.get("price", "0").strip(),
                    "inStock": True,
                    "whatsappNumber": "9779800000000", # Default
                    "specs": {
                         "Type": row.get("type", row.get("category", "")).title(),
                         "Quality": "Premium" 
                    }
                }
                products.append(product)

    except FileNotFoundError:
        print(f"Error: File {csv_file_path} not found.")
        return

    # Create the JS content
    js_content = f"const products = {json.dumps(products, indent=2)};"
    
    with open('new_products.js', 'w', encoding='utf-8') as jsfile:
        jsfile.write(js_content)
    
    print(f"Successfully converted {len(products)} products to 'new_products.js'.")
    print("You can now copy the content of 'new_products.js' into 'assets/js/products_data.js'.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 convert_products.py <filename.csv>")
    else:
        convert_csv_to_js(sys.argv[1])
