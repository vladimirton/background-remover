import React, { useState, useRef, useCallback, useEffect } from 'react';

function App() {
	const [imageSrc, setImageSrc] = useState(null); // Состояние для хранения источника изображения
	const [downloadUrl, setDownloadUrl] = useState(null); // Состояние для хранения URL для загрузки обработанного изображения
	const [fileName, setFileName] = useState(''); // Состояние для хранения имени файла
	const [loading, setLoading] = useState(false); // Состояние для отслеживания загрузки
	const [remainingCredits, setRemainingCredits] = useState(null); // Состояние для хранения оставшихся кредитов
	const [consumedCredits, setConsumedCredits] = useState(null); // Состояние для хранения потребленных кредитов
	const canvasRef = useRef(null); // Ссылка на элемент canvas

	const apiKey = import.meta.env.VITE_API_KEY; // Использование переменной окружения
	console.log('API Key:', apiKey); // Временная строка для проверки значения переменной

	// Обработчик изменения изображения (выбор файла)
	const handleImageChange = useCallback((event) => {
		const file = event.target.files[0]; // Получаем выбранный файл
		if (file) {
			sendToAPI(file); // Отправляем файл в API для удаления фона
			setFileName(file.name.replace(/\.[^/.]+$/, '') + '.png'); // Обновляем имя файла на .png
		}
	}, []);

	// Функция для отправки файла изображения в API для удаления фона
	const sendToAPI = (file) => {
		const form = new FormData();
		form.append('image_file', file); // Добавляем файл в форму

		setLoading(true); // Устанавливаем состояние загрузки в true

		fetch('https://clipdrop-api.co/remove-background/v1', {
			method: 'POST',
			headers: {
				'x-api-key': apiKey, // Замените на ваш действительный API ключ
				Accept: 'image/png', // Запрашиваем изображение в формате PNG
			},
			body: form,
		})
			.then((response) => {
				setRemainingCredits(response.headers.get('x-remaining-credits')); // Обновляем состояние оставшихся кредитов
				setConsumedCredits(response.headers.get('x-credits-consumed')); // Обновляем состояние потребленных кредитов
				return response.arrayBuffer(); // Получаем ответ в виде массива байтов
			})
			.then((buffer) => {
				const blob = new Blob([buffer], { type: 'image/png' }); // Создаем Blob в формате PNG
				const url = URL.createObjectURL(blob); // Создаем URL для Blob
				setImageSrc(url); // Устанавливаем источник изображения для загрузки в canvas
				setLoading(false); // Устанавливаем состояние загрузки в false
			})
			.catch((error) => {
				console.error('Ошибка при вызове API:', error);
				setLoading(false); // Устанавливаем состояние загрузки в false
			});
	};

	// Загрузка и обрезка изображения на canvas
	const loadAndCropImage = useCallback(() => {
		if (!imageSrc) return;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Устанавливаем атрибут willReadFrequently
		const img = new Image();
		img.onload = () => {
			const { width, height } = img;
			canvas.width = width;
			canvas.height = height;
			ctx.drawImage(img, 0, 0); // Рисуем изображение на canvas
			const imageData = ctx.getImageData(0, 0, width, height); // Получаем данные изображения с canvas
			const croppedData = cropTransparent(imageData, ctx); // Обрезаем прозрачные области
			canvas.width = croppedData.width;
			canvas.height = croppedData.height;
			ctx.putImageData(croppedData, 0, 0); // Помещаем обрезанные данные обратно на canvas
			const dataUrl = canvas.toDataURL('image/png'); // Получаем data URL в формате PNG
			setDownloadUrl(dataUrl); // Устанавливаем URL для скачивания
		};
		img.onerror = (error) => {
			console.error('Ошибка загрузки изображения на canvas:', error);
		};
		img.src = imageSrc; // Устанавливаем источник изображения
	}, [imageSrc]);

	// Функция для обрезки прозрачных областей изображения
	const cropTransparent = (imageData, ctx) => {
		const { width, height, data } = imageData;
		let minX = width,
			minY = height,
			maxX = 0,
			maxY = 0;
		const alphaThreshold = 50; // Порог альфа-канала для обрезки

		// Поиск граничных координат непрозрачных пикселей
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const alpha = data[(y * width + x) * 4 + 3];
				if (alpha > alphaThreshold) {
					minX = Math.min(minX, x);
					maxX = Math.max(maxX, x);
					minY = Math.min(minY, y);
					maxY = Math.max(maxY, y);
				}
			}
		}

		// Проверка на случай, если обрезать нечего
		if (minX > maxX || minY > maxY) {
			return ctx.createImageData(1, 1); // Возвращает минимальное изображение, если обрезать нечего
		}

		// Создание данных для обрезанного изображения
		const croppedWidth = maxX - minX + 1;
		const croppedHeight = maxY - minY + 1;
		const cropped = ctx.createImageData(croppedWidth, croppedHeight);

		// Копирование данных обрезанного изображения
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				for (let i = 0; i < 4; i++) {
					const index = (y - minY) * croppedWidth * 4 + (x - minX) * 4 + i;
					cropped.data[index] = data[(y * width + x) * 4 + i];
				}
			}
		}
		return cropped;
	};

	// Загрузка и обрезка изображения при изменении imageSrc
	useEffect(() => {
		if (imageSrc) {
			loadAndCropImage();
		}
	}, [imageSrc, loadAndCropImage]);

	return (
		<div className='App min-h-screen flex flex-col items-center justify-center p-4 space-y-4 overflow-hidden bg-gray-100'>
			<div className='flex flex-col items-center space-y-2'>
				<div className='flex'>
					<input
						type='file'
						accept='image/png, image/jpeg, image/webp'
						className='file:cursor-pointer file:border-0 file:py-2 file:px-4 file:rounded file:bg-blue-500 file:text-white file:hover:bg-blue-600 file:transition-colors'
						onChange={handleImageChange}
					/>
					{downloadUrl && (
						<div>
							<a
								href={downloadUrl}
								download={fileName}
								className='block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors'
							>
								Скачать изображение
							</a>
						</div>
					)}
				</div>
				{remainingCredits !== null && (
					<div className='text-sm text-gray-700'>
						Осталось кредитов: {remainingCredits}
					</div>
				)}
				{consumedCredits !== null && (
					<div className='text-sm text-gray-700'>
						Потреблено кредитов: {consumedCredits}
					</div>
				)}
			</div>
			{loading && (
				<div className='flex items-center justify-center'>
					<div className='w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin'></div>
				</div>
			)}
			{imageSrc && (
				<canvas
					ref={canvasRef}
					className='h-[50vh] border-2 border-gray-300'
				></canvas>
			)}
		</div>
	);
}

export default App;
