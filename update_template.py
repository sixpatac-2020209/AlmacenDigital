#!/usr/bin/env python3
import os

file_path = 'src/app/components/home/home.component.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace EShopper logo with image
old_text = '<h1 class="mb-4 display-5 font-weight-semi-bold"><span class="text-primary font-weight-bold border border-white px-3 mr-1">E</span>Shopper</h1>'
new_text = '<img src="assets/img/AlmacenDigitalLogo.png" alt="Almacén Digital" style="height: 80px; width: auto;">'

content = content.replace(old_text, new_text)

# Update footer description
old_desc = '<p>Dolore erat dolor sit lorem vero amet. Sed sit lorem magna, ipsum no sit erat lorem et magna ipsum dolore amet erat.</p>'
new_desc = '<p>Tu solución confiable para almacenamiento digital seguro. Gestiona, organiza y accede a tus documentos desde cualquier lugar.</p>'

content = content.replace(old_desc, new_desc)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Updated home component with new logos and descriptions")
