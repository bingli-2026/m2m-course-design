#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "gateway";

void app_main(void)
{
    int frame = 0;
    ESP_LOGI(TAG, "gateway started");

    while (1) {
        ESP_LOGI(TAG,
                 "bridge tick -> recv(esp-now)=%d forward(mqtt)=%d",
                 frame,
                 frame);
        frame++;
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}
